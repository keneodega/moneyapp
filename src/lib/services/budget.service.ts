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

    // Check if a budget with this name already exists for this monthly overview
    const { data: existing } = await this.supabase
      .from('budgets')
      .select('id, name')
      .eq('monthly_overview_id', data.monthly_overview_id)
      .eq('name', data.name.trim())
      .maybeSingle();

    if (existing) {
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
}
