/**
 * Budget Service
 * 
 * Handles all business logic for budget categories within a monthly overview.
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Budget, 
  BudgetInsert, 
  BudgetUpdate,
  BudgetSummary 
} from '@/lib/supabase/database.types';
import { NotFoundError, UnauthorizedError, ValidationError } from './errors';

export class BudgetService {
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
   * Verify the user owns the monthly overview
   */
  private async verifyOwnership(monthlyOverviewId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('monthly_overviews')
      .select('id')
      .eq('id', monthlyOverviewId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Monthly Overview', monthlyOverviewId);
    }
  }

  /**
   * Create a new budget category
   * Note: Default budgets are auto-created when a monthly overview is created.
   * This method is for adding additional custom categories.
   * 
   * @param data - Budget data
   */
  async create(data: BudgetInsert): Promise<Budget> {
    await this.getUserId();
    await this.verifyOwnership(data.monthly_overview_id);

    // Validate budget amount
    if (data.budget_amount < 0) {
      throw new ValidationError('Budget amount cannot be negative', 'budget_amount');
    }

    // Check if a budget with this name or master_budget_id already exists for this monthly overview
    if (data.master_budget_id) {
      // Check by master_budget_id first (more specific)
      const { data: existingByMaster } = await this.supabase
        .from('budgets')
        .select('id, name')
        .eq('monthly_overview_id', data.monthly_overview_id)
        .eq('master_budget_id', data.master_budget_id)
        .maybeSingle();
      
      if (existingByMaster) {
        throw new ValidationError(
          `This master budget has already been added to this month. Please edit the existing budget instead.`,
          'master_budget_id'
        );
      }
    }
    
    // Also check by name (for backwards compatibility)
    const { data: existingByName } = await this.supabase
      .from('budgets')
      .select('id, name')
      .eq('monthly_overview_id', data.monthly_overview_id)
      .eq('name', data.name.trim())
      .maybeSingle();

    if (existingByName) {
      throw new ValidationError(
        `A budget category named "${data.name.trim()}" already exists for this month. Please use a different name or edit the existing budget.`,
        'name'
      );
    }

    // If override_amount is set, override_reason must be provided
    if (data.override_amount !== null && data.override_amount !== undefined) {
      if (!data.override_reason || !data.override_reason.trim()) {
        throw new ValidationError(
          'A reason is required when overriding the master budget amount',
          'override_reason'
        );
      }
    }

    const { data: budget, error } = await this.supabase
      .from('budgets')
      .insert({
        ...data,
        name: data.name.trim(),
      })
      .select()
      .single();

    if (error) {
      // Check if error is due to unique constraint violation
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        throw new ValidationError(
          `A budget category named "${data.name.trim()}" already exists for this month.`,
          'name'
        );
      }
      throw new Error(`Failed to create budget: ${error.message}`);
    }

    return budget;
  }

  /**
   * Get all budgets for a monthly overview
   */
  async getByMonthlyOverview(monthlyOverviewId: string): Promise<Budget[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch budgets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all budgets with summaries (amount spent, amount left, etc.)
   */
  async getWithSummaries(monthlyOverviewId: string): Promise<BudgetSummary[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch budget summaries: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single budget by ID
   */
  async getById(id: string): Promise<Budget> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Budget', id);
    }

    return data;
  }

  /**
   * Get a budget with its summary
   */
  async getWithSummary(id: string): Promise<BudgetSummary> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Budget', id);
    }

    return data;
  }

  /**
   * Update a budget
   * 
   * Note: Reducing budget_amount could cause existing expenses to be "overspent"
   * This is allowed (like in Salesforce) but will show negative amount_left
   */
  async update(id: string, data: BudgetUpdate): Promise<Budget> {
    await this.getUserId();

    // Validate budget amount if provided
    if (data.budget_amount !== undefined && data.budget_amount < 0) {
      throw new ValidationError('Budget amount cannot be negative', 'budget_amount');
    }

    // If override_amount is set, override_reason must be provided
    if (data.override_amount !== null && data.override_amount !== undefined) {
      if (!data.override_reason || !data.override_reason.trim()) {
        throw new ValidationError(
          'A reason is required when overriding the master budget amount',
          'override_reason'
        );
      }
    }

    // If override_amount is null, also clear override_reason
    if (data.override_amount === null) {
      data.override_reason = null;
    }

    const { data: updated, error } = await this.supabase
      .from('budgets')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update budget: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Budget', id);
    }

    return updated;
  }

  /**
   * Delete a budget
   * This will cascade delete all expenses in this budget
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete budget: ${error.message}`);
    }
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.getUserId();
    if (ids.length === 0) return;

    const { error } = await this.supabase
      .from('budgets')
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to delete budgets: ${error.message}`);
    }
  }

  /**
   * Check if a budget has remaining funds
   */
  async hasRemainingFunds(id: string): Promise<boolean> {
    const summary = await this.getWithSummary(id);
    return summary.amount_left > 0;
  }

  /**
   * Get the amount left in a budget
   */
  async getAmountLeft(id: string): Promise<number> {
    const summary = await this.getWithSummary(id);
    return summary.amount_left;
  }

  /**
   * Get budgets that are overspent (negative amount left)
   */
  async getOverspentBudgets(monthlyOverviewId: string): Promise<BudgetSummary[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .lt('amount_left', 0);

    if (error) {
      throw new Error(`Failed to fetch overspent budgets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get budget utilization summary for a monthly overview
   */
  async getUtilizationSummary(monthlyOverviewId: string): Promise<{
    totalBudgeted: number;
    totalSpent: number;
    totalLeft: number;
    percentUsed: number;
  }> {
    const summaries = await this.getWithSummaries(monthlyOverviewId);

    const totalBudgeted = summaries.reduce((sum, b) => sum + b.budget_amount, 0);
    const totalSpent = summaries.reduce((sum, b) => sum + b.amount_spent, 0);
    const totalLeft = totalBudgeted - totalSpent;
    const percentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

    return {
      totalBudgeted,
      totalSpent,
      totalLeft,
      percentUsed,
    };
  }

  /**
   * Get history for a specific budget
   */
  async getHistory(budgetId: string, options?: { limit?: number }): Promise<BudgetHistoryEntry[]> {
    await this.getUserId();

    let query = this.supabase
      .from('budget_history')
      .select('*')
      .eq('budget_id', budgetId)
      .order('changed_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch budget history: ${error.message}`);
    }

    return (data || []).map((entry) => ({
      id: entry.id,
      budget_id: entry.budget_id,
      master_budget_id: entry.master_budget_id,
      monthly_overview_id: entry.monthly_overview_id,
      user_id: entry.user_id,
      action: entry.action as 'created' | 'updated' | 'deleted',
      old_data: entry.old_data,
      new_data: entry.new_data,
      changed_at: entry.changed_at,
    }));
  }

  /**
   * Get history for all budgets belonging to a master budget
   */
  async getHistoryByMasterBudget(masterBudgetId: string, options?: { limit?: number }): Promise<BudgetHistoryEntry[]> {
    await this.getUserId();

    let query = this.supabase
      .from('budget_history')
      .select('*')
      .eq('master_budget_id', masterBudgetId)
      .order('changed_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch budget history: ${error.message}`);
    }

    return (data || []).map((entry) => ({
      id: entry.id,
      budget_id: entry.budget_id,
      master_budget_id: entry.master_budget_id,
      monthly_overview_id: entry.monthly_overview_id,
      user_id: entry.user_id,
      action: entry.action as 'created' | 'updated' | 'deleted',
      old_data: entry.old_data,
      new_data: entry.new_data,
      changed_at: entry.changed_at,
    }));
  }

  /**
   * Get trends for a master budget across time periods
   */
  async getTrendsByMasterBudget(
    masterBudgetId: string,
    period: 'week' | 'month' | 'year'
  ): Promise<BudgetTrend[]> {
    await this.getUserId();

    // Get all budgets for this master budget
    const { data: budgets, error: budgetsError } = await this.supabase
      .from('budgets')
      .select('id, budget_amount, monthly_overview_id')
      .eq('master_budget_id', masterBudgetId);

    if (budgetsError) {
      throw new Error(`Failed to fetch budgets: ${budgetsError.message}`);
    }

    if (!budgets || budgets.length === 0) {
      return [];
    }

    // Get monthly overviews for these budgets
    const monthlyOverviewIds = [...new Set(budgets.map((b) => b.monthly_overview_id))];
    const { data: monthlyOverviews, error: monthlyError } = await this.supabase
      .from('monthly_overviews')
      .select('id, start_date, end_date, name')
      .in('id', monthlyOverviewIds)
      .order('start_date', { ascending: true });

    if (monthlyError) {
      throw new Error(`Failed to fetch monthly overviews: ${monthlyError.message}`);
    }

    // Create a map of monthly overview ID to monthly overview data
    const monthlyMap = new Map(
      (monthlyOverviews || []).map((mo) => [mo.id, mo])
    );

    // Get spending data for each budget
    const budgetIds = budgets.map((b) => b.id);
    const { data: expenses, error: expensesError } = await this.supabase
      .from('expenses')
      .select('budget_id, amount, date')
      .in('budget_id', budgetIds);

    if (expensesError) {
      throw new Error(`Failed to fetch expenses: ${expensesError.message}`);
    }

    // Group by period and aggregate
    const trendsMap = new Map<string, { budgeted: number; spent: number; period: string }>();

    for (const budget of budgets) {
      const monthlyOverview = monthlyMap.get(budget.monthly_overview_id);
      
      if (!monthlyOverview) {
        // Skip budgets without valid monthly overview
        continue;
      }

      const startDate = new Date(monthlyOverview.start_date);
      let periodKey: string;

      if (period === 'week') {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
        periodKey = `${weekStart.getFullYear()}-W${getWeekNumber(weekStart)}`;
      } else if (period === 'month') {
        periodKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      } else {
        periodKey = String(startDate.getFullYear());
      }

      const existing = trendsMap.get(periodKey) || { budgeted: 0, spent: 0, period: periodKey };
      existing.budgeted += Number(budget.budget_amount || 0);

      // Add expenses for this budget
      const budgetExpenses = expenses?.filter((e) => e.budget_id === budget.id) || [];
      const totalSpent = budgetExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      existing.spent += totalSpent;

      trendsMap.set(periodKey, existing);
    }

    // Convert to array and sort
    const trends: BudgetTrend[] = Array.from(trendsMap.values())
      .map((t) => ({
        period: t.period,
        budgeted: t.budgeted,
        spent: t.spent,
        remaining: t.budgeted - t.spent,
        utilization: t.budgeted > 0 ? (t.spent / t.budgeted) * 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return trends;
  }
}

// Helper function to get week number
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return String(weekNo).padStart(2, '0');
}

// Types for budget history
export interface BudgetHistoryEntry {
  id: string;
  budget_id: string | null;
  master_budget_id: string | null;
  monthly_overview_id: string | null;
  user_id: string;
  action: 'created' | 'updated' | 'deleted';
  old_data: any | null;
  new_data: any | null;
  changed_at: string;
}

export interface BudgetTrend {
  period: string; // e.g., "2026-01", "2026-W03", "2026"
  budgeted: number;
  spent: number;
  remaining: number;
  utilization: number; // percentage
}
