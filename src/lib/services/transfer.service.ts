/**
 * Transfer Service
 *
 * Handles budget-to-budget transfers, goal-to-budget transfers, and goal drawdowns
 * (draw down and use into DrawDown category).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Transfer,
  TransferInsert,
  MonthlyOverview,
  FinancialGoal,
  Budget,
} from '@/lib/supabase/database.types';
import { NotFoundError, UnauthorizedError, ValidationError } from './errors';
import { BudgetService } from './budget.service';
import { logError } from '@/lib/utils/logger';

const DRAWDOWN_BUDGET_NAME = 'DrawDown';

export class TransferService {
  constructor(private supabase: SupabaseClient) {}

  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    return user.id;
  }

  private async getMonthlyOverview(monthlyOverviewId: string): Promise<MonthlyOverview> {
    const { data, error } = await this.supabase
      .from('monthly_overviews')
      .select('*')
      .eq('id', monthlyOverviewId)
      .single();
    if (error || !data) throw new NotFoundError('Monthly Overview', monthlyOverviewId);
    return data;
  }

  private async getGoal(goalId: string): Promise<FinancialGoal> {
    const { data, error } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('id', goalId)
      .single();
    if (error || !data) throw new NotFoundError('Financial Goal', goalId);
    return data;
  }

  private validateTransferDate(date: string, overview: MonthlyOverview): void {
    const d = new Date(date);
    const start = new Date(overview.start_date);
    const end = new Date(overview.end_date);
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (d < start || d > end) {
      throw new ValidationError(
        `Transfer date must be between ${overview.start_date} and ${overview.end_date}`,
        'date'
      );
    }
  }

  /**
   * Resolve or create the DrawDown budget for the given month.
   */
  async ensureDrawDownBudget(monthlyOverviewId: string): Promise<Budget> {
    const userId = await this.getUserId();
    await this.getMonthlyOverview(monthlyOverviewId);

    const { data: existing } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .eq('name', DRAWDOWN_BUDGET_NAME)
      .maybeSingle();

    if (existing) return existing;

    const budgetService = new BudgetService(this.supabase);
    return budgetService.create({
      monthly_overview_id: monthlyOverviewId,
      name: DRAWDOWN_BUDGET_NAME,
      budget_amount: 0,
      description: 'Variable category for drawdowns (withdrawals from goals for use).',
    });
  }

  /**
   * Create a budget-to-budget transfer.
   */
  async createBudgetToBudget(
    monthlyOverviewId: string,
    fromBudgetId: string,
    toBudgetId: string,
    data: { amount: number; date: string; description?: string; notes?: string; bank?: string }
  ): Promise<Transfer> {
    const userId = await this.getUserId();
    const overview = await this.getMonthlyOverview(monthlyOverviewId);

    if (data.amount <= 0) {
      throw new ValidationError('Transfer amount must be greater than zero', 'amount');
    }
    this.validateTransferDate(data.date, overview);

    if (fromBudgetId === toBudgetId) {
      throw new ValidationError('Source and destination budget must be different', 'to_budget_id');
    }

    const [fromSummary, toBudget] = await Promise.all([
      this.supabase.from('budget_summary').select('amount_left, monthly_overview_id').eq('id', fromBudgetId).single(),
      this.supabase.from('budgets').select('id, monthly_overview_id').eq('id', toBudgetId).single(),
    ]);

    if (fromSummary.error || !fromSummary.data) throw new NotFoundError('Budget', fromBudgetId);
    if (toBudget.error || !toBudget.data) throw new NotFoundError('Budget', toBudgetId);
    if (fromSummary.data.monthly_overview_id !== monthlyOverviewId || toBudget.data.monthly_overview_id !== monthlyOverviewId) {
      throw new ValidationError('Both budgets must belong to the selected month', 'monthly_overview_id');
    }

    const amountLeft = Number(fromSummary.data.amount_left ?? 0);
    if (amountLeft < data.amount) {
      throw new ValidationError(
        `Insufficient amount in source budget. Available: ${amountLeft.toFixed(2)}, Requested: ${data.amount.toFixed(2)}`,
        'amount'
      );
    }

    const insert: TransferInsert = {
      user_id: userId,
      monthly_overview_id: monthlyOverviewId,
      transfer_type: 'budget_to_budget',
      amount: data.amount,
      date: data.date,
      description: data.description ?? null,
      notes: data.notes ?? null,
      bank: (data.bank as import('@/lib/supabase/database.types').BankType) ?? null,
      from_budget_id: fromBudgetId,
      to_budget_id: toBudgetId,
    };

    const { data: transfer, error } = await this.supabase
      .from('transfers')
      .insert(insert)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create budget-to-budget transfer: ${error.message}`), {
        event: 'transfer.create_budget_to_budget.failed',
        metadata: { monthlyOverviewId, fromBudgetId, toBudgetId },
      });
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
    return transfer;
  }

  /**
   * Create a goal-to-budget transfer (withdraw from goal, credit to a chosen budget).
   */
  async createGoalToBudget(
    monthlyOverviewId: string,
    goalId: string,
    toBudgetId: string,
    data: { amount: number; date: string; description?: string; notes?: string; bank?: string }
  ): Promise<Transfer> {
    const userId = await this.getUserId();
    const overview = await this.getMonthlyOverview(monthlyOverviewId);

    if (data.amount <= 0) {
      throw new ValidationError('Transfer amount must be greater than zero', 'amount');
    }
    this.validateTransferDate(data.date, overview);

    const goal = await this.getGoal(goalId);
    if (goal.user_id !== userId) throw new UnauthorizedError();
    const currentAmount = Number(goal.current_amount ?? 0);
    if (currentAmount < data.amount) {
      throw new ValidationError(
        `Insufficient goal balance. Available: ${currentAmount.toFixed(2)}, Requested: ${data.amount.toFixed(2)}`,
        'amount'
      );
    }

    const { data: toBudget, error: toErr } = await this.supabase
      .from('budgets')
      .select('id, monthly_overview_id')
      .eq('id', toBudgetId)
      .single();
    if (toErr || !toBudget) throw new NotFoundError('Budget', toBudgetId);
    if (toBudget.monthly_overview_id !== monthlyOverviewId) {
      throw new ValidationError('Destination budget must belong to the selected month', 'to_budget_id');
    }

    const insert: TransferInsert = {
      user_id: userId,
      monthly_overview_id: monthlyOverviewId,
      transfer_type: 'goal_to_budget',
      amount: data.amount,
      date: data.date,
      description: data.description ?? null,
      notes: data.notes ?? null,
      bank: (data.bank as import('@/lib/supabase/database.types').BankType) ?? null,
      from_goal_id: goalId,
      to_budget_id: toBudgetId,
    };

    const { data: transfer, error } = await this.supabase
      .from('transfers')
      .insert(insert)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create goal-to-budget transfer: ${error.message}`), {
        event: 'transfer.create_goal_to_budget.failed',
        metadata: { monthlyOverviewId, goalId, toBudgetId },
      });
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
    return transfer;
  }

  /**
   * Create a goal drawdown (draw down and use): withdraw from goal into DrawDown category.
   */
  async createGoalDrawdown(
    monthlyOverviewId: string,
    goalId: string,
    data: { amount: number; date: string; description?: string; notes?: string; bank?: string }
  ): Promise<Transfer> {
    const userId = await this.getUserId();
    const overview = await this.getMonthlyOverview(monthlyOverviewId);

    if (data.amount <= 0) {
      throw new ValidationError('Drawdown amount must be greater than zero', 'amount');
    }
    this.validateTransferDate(data.date, overview);

    const goal = await this.getGoal(goalId);
    if (goal.user_id !== userId) throw new UnauthorizedError();
    const currentAmount = Number(goal.current_amount ?? 0);
    if (currentAmount < data.amount) {
      throw new ValidationError(
        `Insufficient goal balance. Available: ${currentAmount.toFixed(2)}, Requested: ${data.amount.toFixed(2)}`,
        'amount'
      );
    }

    const drawDownBudget = await this.ensureDrawDownBudget(monthlyOverviewId);

    const insert: TransferInsert = {
      user_id: userId,
      monthly_overview_id: monthlyOverviewId,
      transfer_type: 'goal_drawdown',
      amount: data.amount,
      date: data.date,
      description: data.description ?? null,
      notes: data.notes ?? null,
      bank: (data.bank as import('@/lib/supabase/database.types').BankType) ?? null,
      from_goal_id: goalId,
      to_budget_id: drawDownBudget.id,
    };

    const { data: transfer, error } = await this.supabase
      .from('transfers')
      .insert(insert)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create goal drawdown: ${error.message}`), {
        event: 'transfer.create_goal_drawdown.failed',
        metadata: { monthlyOverviewId, goalId },
      });
      throw new Error(`Failed to create drawdown: ${error.message}`);
    }
    return transfer;
  }

  async getByMonth(monthlyOverviewId: string): Promise<Transfer[]> {
    await this.getUserId();
    const { data, error } = await this.supabase
      .from('transfers')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .order('date', { ascending: false });

    if (error) {
      logError(new Error(`Failed to fetch transfers for month: ${error.message}`), {
        event: 'transfer.get_by_month.failed',
        metadata: { monthlyOverviewId },
      });
      throw new Error(`Failed to fetch transfers: ${error.message}`);
    }
    return (data ?? []) as Transfer[];
  }

  async getByGoal(goalId: string): Promise<Transfer[]> {
    await this.getUserId();
    const { data, error } = await this.supabase
      .from('transfers')
      .select('*')
      .eq('from_goal_id', goalId)
      .order('date', { ascending: false });

    if (error) {
      logError(new Error(`Failed to fetch transfers for goal: ${error.message}`), {
        event: 'transfer.get_by_goal.failed',
        metadata: { goalId },
      });
      throw new Error(`Failed to fetch transfers: ${error.message}`);
    }
    return (data ?? []) as Transfer[];
  }
}
