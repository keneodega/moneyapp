/**
 * Expense Service
 *
 * Handles all business logic for expense records.
 *
 * An expense records something that already happened, so it is never rejected
 * for being over budget or for falling outside its month's date range. A budget
 * that is exceeded reports as over; a month is the bucket a row is assigned to,
 * not a range it must satisfy.
 *
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Expense,
  ExpenseInsert,
  ExpenseUpdate,
  Budget,
  MonthlyOverview
} from '@/lib/supabase/database.types';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError
} from './errors';
import { logExpenseCreated, logError } from '@/lib/utils/logger';

interface BudgetWithMonthlyOverview extends Budget {
  monthly_overview: MonthlyOverview;
}

interface BudgetSummary {
  id: string;
  monthly_overview_id: string;
  name: string;
  budget_amount: number;
  amount_spent: number;
  amount_left: number;
  percent_used: number;
}

export class ExpenseService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get the current authenticated user ID
   * @throws UnauthorizedError if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if ( !user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get budget with its monthly overview for validation
   */
  private async getBudgetWithMonthlyOverview(budgetId: string): Promise<BudgetWithMonthlyOverview> {
    const { data, error } = await this.supabase
      .from('budgets')
      .select(`
        *,
        monthly_overview:monthly_overviews(*)
      `)
      .eq('id', budgetId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Budget', budgetId);
    }

    return data as BudgetWithMonthlyOverview;
  }

  /**
   * Get budget summary (includes amount spent calculations)
   */
  private async getBudgetSummary(budgetId: string): Promise<BudgetSummary> {
    const { data, error } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('id', budgetId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Budget', budgetId);
    }

    return data as BudgetSummary;
  }

  /**
   * Create a new expense
   *
   * @param data - Expense data
   * @returns The created expense
   */
  async create(data: Omit<ExpenseInsert, 'user_id'>): Promise<Expense> {
    const userId = await this.getUserId();

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new ValidationError('Expense amount must be greater than zero', 'amount');
    }

    // Resolves the budget for logging, and 404s on an unknown budget_id
    const budgetWithMonth = await this.getBudgetWithMonthlyOverview(data.budget_id);

    // Create the expense
    const { data: expense, error } = await this.supabase
      .from('expenses')
      .insert({
        ...data,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create expense: ${error.message}`), {
        event: 'expense.create.failed',
        userId,
        metadata: { budgetId: data.budget_id, amount: data.amount, date: data.date },
      });
      throw new Error(`Failed to create expense: ${error.message}`);
    }

    // Log successful expense creation
    logExpenseCreated({
      expenseId: expense.id,
      userId,
      amount: expense.amount,
      budgetId: expense.budget_id,
      budgetName: budgetWithMonth.name,
      monthlyOverviewId: budgetWithMonth.monthly_overview_id,
      date: expense.date,
    });

    return expense;
  }

  /**
   * Get all expenses for the current user
   * @param budgetId - Optional filter by budget
   * @param monthlyOverviewId - Optional filter by monthly overview
   */
  async getAll(budgetId?: string, monthlyOverviewId?: string): Promise<Expense[]> {
    await this.getUserId();

    let query = this.supabase
      .from('expenses')
      .select(`
        *,
        budget:budgets(
          id,
          name,
          monthly_overview_id
        )
      `)
      .order('date', { ascending: false });

    if (budgetId) {
      query = query.eq('budget_id', budgetId);
    }

    if (monthlyOverviewId) {
      query = query.eq('budget.monthly_overview_id', monthlyOverviewId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get expenses for a specific budget
   */
  async getByBudget(budgetId: string): Promise<Expense[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*')
      .eq('budget_id', budgetId)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single expense by ID
   */
  async getById(id: string): Promise<Expense> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Expense', id);
    }

    return data;
  }

  /**
   * Update an expense
   *
   * @param id - Expense ID
   * @param data - Fields to update
   */
  async update(id: string, data: ExpenseUpdate): Promise<Expense> {
    await this.getUserId();

    // Get the existing expense
    const existingExpense = await this.getById(id);

    // 404s on an unknown budget_id
    const budgetId = data.budget_id || existingExpense.budget_id;
    await this.getBudgetWithMonthlyOverview(budgetId);

    // Update the expense
    const { data: updated, error } = await this.supabase
      .from('expenses')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update expense: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Expense', id);
    }

    return updated;
  }

  /**
   * Delete an expense
   * 
   * @param id - Expense ID
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    // Verify expense exists
    await this.getById(id);

    // Delete the expense
    const { error } = await this.supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.getUserId();
    if (ids.length === 0) return;

    const { error } = await this.supabase
      .from('expenses')
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to delete expenses: ${error.message}`);
    }
  }

  /**
   * Get expenses by date range
   */
  async getByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get total expenses for a budget (useful for calculations)
   */
  async getTotalForBudget(budgetId: string): Promise<number> {
    const budgetSummary = await this.getBudgetSummary(budgetId);
    return budgetSummary.amount_spent;
  }
}
