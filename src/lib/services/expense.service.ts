/**
 * Expense Service
 * 
 * Handles all business logic for expense records.
 * 
 * Key Business Rules:
 * 1. Expense date must be within the Monthly Overview date range
 *    (Replicates Salesforce Validation Rule: ExpenseDate_WithinMonthlyOverview)
 * 
 * 2. Cannot overspend - expense cannot cause negative budget amount left
 *    (Replicates Salesforce Validation Rule: Prevent_Overspending)
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
  ExpenseDateOutOfRangeError, 
  OverspendingError, 
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
   * Validate that the expense date is within the monthly overview date range
   * 
   * Business Rule: ExpenseDate_WithinMonthlyOverview
   * Error: "The Expense Date must be between the Start Date and End Date 
   *         of the associated Monthly Overview."
   * 
   * @param expenseDate - The date of the expense
   * @param monthlyOverview - The monthly overview containing start/end dates
   * @throws ExpenseDateOutOfRangeError if date is outside range
   */
  private validateExpenseDate(expenseDate: string, monthlyOverview: MonthlyOverview): void {
    const expense = new Date(expenseDate);
    const start = new Date(monthlyOverview.start_date);
    const end = new Date(monthlyOverview.end_date);

    // Set times to midnight for date-only comparison
    expense.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (expense < start || expense > end) {
      throw new ExpenseDateOutOfRangeError(
        expenseDate,
        monthlyOverview.start_date,
        monthlyOverview.end_date
      );
    }
  }

  /**
   * Validate that adding/updating an expense won't cause overspending
   * 
   * Business Rule: Prevent_Overspending
   * Error: "Pocket would be negative"
   * 
   * @param budgetSummary - Current budget summary with amount spent
   * @param newExpenseAmount - Amount being added
   * @param existingExpenseAmount - Amount being replaced (for updates), default 0
   * @throws OverspendingError if expense would cause negative budget
   */
  private validateNoOverspending(
    budgetSummary: BudgetSummary,
    newExpenseAmount: number,
    existingExpenseAmount: number = 0
  ): void {
    // Calculate what the new amount left would be
    // For updates: add back the existing amount, then subtract the new amount
    const projectedAmountLeft = 
      budgetSummary.amount_left + existingExpenseAmount - newExpenseAmount;

    if (projectedAmountLeft < 0) {
      throw new OverspendingError(
        budgetSummary.name,
        budgetSummary.budget_amount,
        budgetSummary.amount_spent - existingExpenseAmount,
        newExpenseAmount
      );
    }
  }

  /**
   * Create a new expense
   * 
   * Validates:
   * 1. Expense date is within monthly overview range
   * 2. Expense won't cause overspending
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

    // Get budget with monthly overview for validation
    const budgetWithMonth = await this.getBudgetWithMonthlyOverview(data.budget_id);

    // RULE 1: Validate expense date is within monthly overview range
    this.validateExpenseDate(data.date, budgetWithMonth.monthly_overview);

    // Get budget summary for overspending check
    const budgetSummary = await this.getBudgetSummary(data.budget_id);

    // RULE 2: Validate no overspending
    this.validateNoOverspending(budgetSummary, data.amount);

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
   * Validates:
   * 1. If date changes, it must still be within monthly overview range
   * 2. If amount changes, it must not cause overspending
   * 
   * @param id - Expense ID
   * @param data - Fields to update
   */
  async update(id: string, data: ExpenseUpdate): Promise<Expense> {
    await this.getUserId();

    // Get the existing expense
    const existingExpense = await this.getById(id);

    // Determine the budget to validate against
    const budgetId = data.budget_id || existingExpense.budget_id;
    const budgetWithMonth = await this.getBudgetWithMonthlyOverview(budgetId);

    // RULE 1: Validate expense date if it's being changed or budget is changing
    const expenseDate = data.date || existingExpense.date;
    this.validateExpenseDate(expenseDate, budgetWithMonth.monthly_overview);

    // RULE 2: Validate no overspending if amount is changing
    if (data.amount !== undefined || data.budget_id !== undefined) {
      const budgetSummary = await this.getBudgetSummary(budgetId);
      const newAmount = data.amount ?? existingExpense.amount;
      
      // If budget is changing, existing expense doesn't count against new budget
      const existingAmountInBudget = data.budget_id && data.budget_id !== existingExpense.budget_id
        ? 0
        : existingExpense.amount;

      this.validateNoOverspending(budgetSummary, newAmount, existingAmountInBudget);
    }

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

    // Handle goal updates - recalculate affected goals whenever expense changes
    const oldGoalId = existingExpense.financial_goal_id;
    const newGoalId = updated.financial_goal_id;
    const amountChanged = data.amount !== undefined && data.amount !== existingExpense.amount;
    const goalIdChanged = oldGoalId !== newGoalId;

    console.log('Expense update - goal recalculation check:', {
      expenseId: id,
      oldGoalId,
      newGoalId,
      amountChanged,
      goalIdChanged,
      oldAmount: existingExpense.amount,
      newAmount: updated.amount,
    });

    // Recalculate goals if:
    // 1. Amount changed and expense is linked to a goal (old or new)
    // 2. Goal link changed (need to update both old and new)
    if (amountChanged || goalIdChanged) {
      try {
        const { FinancialGoalService } = await import('./financial-goal.service');
        const goalService = new FinancialGoalService(this.supabase);

        // Recalculate old goal if link was removed or changed
        if (goalIdChanged && oldGoalId) {
          console.log(`Recalculating old goal ${oldGoalId} after expense update`);
          await goalService.recalculateCurrentAmount(oldGoalId);
        }

        // Recalculate goal if:
        // 1. Amount changed and expense is linked to a goal
        // 2. Goal link changed (new goal)
        if (newGoalId && (goalIdChanged || amountChanged)) {
          console.log(`Recalculating goal ${newGoalId} after expense update (amountChanged: ${amountChanged}, goalIdChanged: ${goalIdChanged})`);
          await goalService.recalculateCurrentAmount(newGoalId);
        }
      } catch (err) {
        // Don't fail expense update if goal update fails, but log the error
        console.error('Error updating goal after expense update:', err);
        if (err instanceof Error) {
          console.error('Error details:', err.message, err.stack);
        }
      }
    } else {
      console.log('No goal recalculation needed - amount and goal link unchanged');
    }

    return updated;
  }

  /**
   * Delete an expense
   * 
   * If the expense is linked to a financial goal, updates the goal's current_amount
   * by subtracting the expense amount and recalculates progress.
   * 
   * @param id - Expense ID
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    // Get the expense before deleting to check if it's linked to a goal
    const expense = await this.getById(id);

    // Delete the expense
    const { error } = await this.supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }

    // If expense was linked to a goal, recalculate the goal's current_amount
    if (expense.financial_goal_id) {
      try {
        // Use the FinancialGoalService to recalculate properly (base_amount + expenses)
        const { FinancialGoalService } = await import('./financial-goal.service');
        const goalService = new FinancialGoalService(this.supabase);
        await goalService.recalculateCurrentAmount(expense.financial_goal_id);
      } catch (err) {
        // Don't fail expense deletion if goal update fails
        console.error('Error updating goal after expense deletion:', err);
      }
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
