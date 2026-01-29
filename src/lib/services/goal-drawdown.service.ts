/**
 * Goal Drawdown Service
 * 
 * Handles all business logic for goal drawdowns (withdrawals).
 * Drawdowns decrease goal amounts and track money withdrawn from financial goals.
 * 
 * Key Business Rules:
 * 1. Drawdown amount must be positive
 * 2. Drawdown date must be within the monthly overview date range
 * 3. Drawdown cannot exceed goal's current_amount (prevents negative balances)
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  GoalDrawdown, 
  GoalDrawdownInsert, 
  GoalDrawdownUpdate,
  MonthlyOverview,
  FinancialGoal 
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';
import { logError } from '@/lib/utils/logger';

export class GoalDrawdownService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   * @throws UnauthorizedError if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get monthly overview for validation
   */
  private async getMonthlyOverview(monthlyOverviewId: string): Promise<MonthlyOverview> {
    const { data: overview, error: overviewError } = await this.supabase
      .from('monthly_overviews')
      .select('*')
      .eq('id', monthlyOverviewId)
      .single();

    if (overviewError || !overview) {
      throw new NotFoundError('Monthly Overview', monthlyOverviewId);
    }

    return overview;
  }

  /**
   * Get goal with current amount for validation
   */
  private async getGoal(goalId: string): Promise<FinancialGoal> {
    const { data: goal, error: goalError } = await this.supabase
      .from('financial_goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (goalError || !goal) {
      throw new NotFoundError('Financial Goal', goalId);
    }

    return goal;
  }

  /**
   * Validate that the drawdown date is within the monthly overview date range
   */
  private validateDrawdownDate(drawdownDate: string, monthlyOverview: MonthlyOverview): void {
    const drawdown = new Date(drawdownDate);
    const start = new Date(monthlyOverview.start_date);
    const end = new Date(monthlyOverview.end_date);

    // Set times to midnight for date-only comparison
    drawdown.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (drawdown < start || drawdown > end) {
      throw new ValidationError(
        `Drawdown date must be between ${monthlyOverview.start_date} and ${monthlyOverview.end_date}`,
        'date'
      );
    }
  }

  /**
   * Validate that the drawdown amount doesn't exceed goal's current amount
   */
  private validateDrawdownAmount(
    currentAmount: number,
    drawdownAmount: number,
    existingDrawdownAmount: number = 0
  ): void {
    // For updates: add back the existing amount, then subtract the new amount
    const projectedAmount = currentAmount + existingDrawdownAmount - drawdownAmount;

    if (projectedAmount < 0) {
      throw new ValidationError(
        `Drawdown amount exceeds available goal balance. Current: ${currentAmount.toFixed(2)}, Attempted: ${drawdownAmount.toFixed(2)}`,
        'amount'
      );
    }
  }

  /**
   * Create a new goal drawdown
   * 
   * Validates:
   * 1. Amount is positive
   * 2. Date is within monthly overview range
   * 3. Amount doesn't exceed goal's current_amount
   * 
   * @param monthlyOverviewId - The month this drawdown belongs to
   * @param goalId - The goal being drawn from
   * @param data - Drawdown data (amount, date, description, bank, notes)
   * @returns The created drawdown
   */
  async create(
    monthlyOverviewId: string,
    goalId: string,
    data: {
      amount: number;
      date: string;
      description?: string;
      bank?: string;
      notes?: string;
    }
  ): Promise<GoalDrawdown> {
    const userId = await this.getUserId();

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new ValidationError('Drawdown amount must be greater than zero', 'amount');
    }

    // Get monthly overview for validation
    const overview = await this.getMonthlyOverview(monthlyOverviewId);

    // Validate date is within monthly overview range
    this.validateDrawdownDate(data.date, overview);

    // Get goal to check current amount
    const goal = await this.getGoal(goalId);

    // Verify goal belongs to user
    if (goal.user_id !== userId) {
      throw new UnauthorizedError();
    }

    // Validate drawdown doesn't exceed current amount
    const currentAmount = Number(goal.current_amount || 0);
    this.validateDrawdownAmount(currentAmount, data.amount);

    // Create the drawdown
    // The trigger will automatically update the goal's current_amount
    const { data: drawdown, error } = await this.supabase
      .from('goal_drawdowns')
      .insert({
        financial_goal_id: goalId,
        user_id: userId,
        monthly_overview_id: monthlyOverviewId,
        amount: data.amount,
        date: data.date,
        description: data.description || null,
        bank: data.bank || null,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create goal drawdown: ${error.message}`), {
        event: 'goal_drawdown.create.failed',
        userId,
        metadata: { monthlyOverviewId, goalId, amount: data.amount },
      });
      throw new Error(`Failed to create goal drawdown: ${error.message}`);
    }

    return drawdown;
  }

  /**
   * Get all drawdowns for a specific goal
   * @param goalId - The goal ID
   * @returns Array of drawdowns
   */
  async getByGoal(goalId: string): Promise<GoalDrawdown[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('goal_drawdowns')
      .select(`
        *,
        monthly_overview:monthly_overviews(
          id,
          name,
          start_date,
          end_date
        )
      `)
      .eq('financial_goal_id', goalId)
      .order('date', { ascending: false });

    if (error) {
      logError(new Error(`Failed to fetch drawdowns for goal: ${error.message}`), {
        event: 'goal_drawdown.get_by_goal.failed',
        metadata: { goalId },
      });
      throw new Error(`Failed to fetch drawdowns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all drawdowns for a specific month
   * @param monthlyOverviewId - The month ID
   * @returns Array of drawdowns with goal info
   */
  async getByMonth(monthlyOverviewId: string): Promise<(GoalDrawdown & {
    financial_goal: { id: string; name: string; target_amount: number };
  })[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('goal_drawdowns')
      .select(`
        *,
        financial_goal:financial_goals(
          id,
          name,
          target_amount
        )
      `)
      .eq('monthly_overview_id', monthlyOverviewId)
      .order('date', { ascending: false });

    if (error) {
      logError(new Error(`Failed to fetch drawdowns for month: ${error.message}`), {
        event: 'goal_drawdown.get_by_month.failed',
        metadata: { monthlyOverviewId },
      });
      throw new Error(`Failed to fetch drawdowns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update an existing drawdown
   * 
   * Validates:
   * 1. Amount is positive
   * 2. Date is within monthly overview range
   * 3. Updated amount doesn't exceed goal's current amount
   * 
   * @param id - Drawdown ID
   * @param data - Updated drawdown data
   * @returns The updated drawdown
   */
  async update(id: string, data: Partial<GoalDrawdownUpdate>): Promise<GoalDrawdown> {
    const userId = await this.getUserId();

    // Get existing drawdown
    const { data: existing, error: fetchError } = await this.supabase
      .from('goal_drawdowns')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Goal Drawdown', id);
    }

    // Validate amount if being updated
    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        throw new ValidationError('Drawdown amount must be greater than zero', 'amount');
      }

      // Get goal to check current amount
      const goal = await this.getGoal(existing.financial_goal_id);
      const currentAmount = Number(goal.current_amount || 0);

      // Validate drawdown doesn't exceed current amount (accounting for existing drawdown)
      this.validateDrawdownAmount(currentAmount, data.amount, Number(existing.amount));
    }

    // Validate date if being updated
    if (data.date !== undefined) {
      const overview = await this.getMonthlyOverview(existing.monthly_overview_id);
      this.validateDrawdownDate(data.date, overview);
    }

    // Update the drawdown
    // The trigger will automatically update the goal's current_amount
    const { data: drawdown, error } = await this.supabase
      .from('goal_drawdowns')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to update goal drawdown: ${error.message}`), {
        event: 'goal_drawdown.update.failed',
        userId,
        metadata: { drawdownId: id },
      });
      throw new Error(`Failed to update drawdown: ${error.message}`);
    }

    return drawdown;
  }

  /**
   * Delete a drawdown
   * The trigger will automatically update the goal's current_amount
   * 
   * @param id - Drawdown ID
   */
  async delete(id: string): Promise<void> {
    const userId = await this.getUserId();

    // Verify drawdown exists and belongs to user
    const { data: existing, error: fetchError } = await this.supabase
      .from('goal_drawdowns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Goal Drawdown', id);
    }

    // Delete the drawdown
    // The trigger will automatically update the goal's current_amount
    const { error } = await this.supabase
      .from('goal_drawdowns')
      .delete()
      .eq('id', id);

    if (error) {
      logError(new Error(`Failed to delete goal drawdown: ${error.message}`), {
        event: 'goal_drawdown.delete.failed',
        userId,
        metadata: { drawdownId: id },
      });
      throw new Error(`Failed to delete drawdown: ${error.message}`);
    }
  }
}
