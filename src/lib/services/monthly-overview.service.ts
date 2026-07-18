/**
 * Monthly Overview Service
 *
 * Handles all business logic for monthly budget periods.
 *
 * When a month is created, its budget categories are copied from the user's
 * active master budgets (bootstrapFromMasterBudgets). Master budgets are the
 * single source of truth for what categories a month starts with.
 *
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  MonthlyOverview,
  MonthlyOverviewInsert,
  MonthlyOverviewUpdate
} from '@/lib/supabase/database.types';
import { NotFoundError, UnauthorizedError, ValidationError } from './errors';
import { logMonthCreated } from '@/lib/utils/logger';
import { MasterBudgetService } from './master-budget.service';
import { BudgetService } from './budget.service';

export class MonthlyOverviewService {
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
   * Create a new monthly overview, then seed its budget categories from the
   * user's active master budgets.
   *
   * @param data - Monthly overview data (name, start_date, end_date)
   * @returns The created monthly overview
   */
  async create(data: Omit<MonthlyOverviewInsert, 'user_id'>): Promise<MonthlyOverview> {
    const userId = await this.getUserId();

    // Validate date range
    if (new Date(data.end_date) < new Date(data.start_date)) {
      throw new ValidationError('End Date must be after Start Date', 'end_date');
    }

    // Create the monthly overview
    const { data: monthlyOverview, error } = await this.supabase
      .from('monthly_overviews')
      .insert({
        ...data,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create monthly overview: ${error.message}`);
    }

    const budgetsCreated = await this.bootstrapFromMasterBudgets(monthlyOverview.id);

    logMonthCreated({
      monthlyOverviewId: monthlyOverview.id,
      userId,
      name: monthlyOverview.name,
      startDate: monthlyOverview.start_date,
      endDate: monthlyOverview.end_date,
      budgetsCreated,
    });

    return monthlyOverview;
  }

  /**
   * Seed a month's budget categories from the user's active master budgets.
   * Idempotent: does nothing if the month already has budgets. Returns the
   * number of budgets created.
   */
  async bootstrapFromMasterBudgets(monthId: string): Promise<number> {
    const { count: existing } = await this.supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('monthly_overview_id', monthId);

    if (existing && existing > 0) return 0;

    const masterBudgets = await new MasterBudgetService(this.supabase).getAll(true);
    const budgetService = new BudgetService(this.supabase);

    let created = 0;
    for (const mb of masterBudgets) {
      try {
        await budgetService.create({
          monthly_overview_id: monthId,
          name: mb.name,
          budget_amount: mb.budget_amount,
          master_budget_id: mb.id,
          description: mb.description || null,
        });
        created++;
      } catch (err) {
        // A duplicate name (already present) is fine; anything else is worth seeing.
        console.warn(`bootstrapFromMasterBudgets: skipped ${mb.name}:`, err);
      }
    }
    return created;
  }


  /**
   * Get all monthly overviews for the current user
   * @param activeOnly - If true, only return active (current) periods
   */
  async getAll(activeOnly: boolean = false): Promise<MonthlyOverview[]> {
    await this.getUserId();

    let query = this.supabase
      .from('monthly_overviews')
      .select('*')
      .order('start_date', { ascending: false });

    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      query = query.lte('start_date', today).gte('end_date', today);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch monthly overviews: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single monthly overview by ID
   * @param id - Monthly overview ID
   */
  async getById(id: string): Promise<MonthlyOverview> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('monthly_overviews')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Monthly Overview', id);
    }

    return data;
  }

  /**
   * Get the currently active monthly overview (if any)
   */
  async getActive(): Promise<MonthlyOverview | null> {
    await this.getUserId();

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('monthly_overviews')
      .select('*')
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(1)
      .single();

    if (error) {
      // No active period found
      return null;
    }

    return data;
  }

  /**
   * Get a monthly overview with its summary (computed fields)
   * Uses the monthly_overview_summary view
   */
  async getWithSummary(id: string) {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('monthly_overview_summary')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Monthly Overview', id);
    }

    return data;
  }

  /**
   * Update a monthly overview
   * @param id - Monthly overview ID
   * @param data - Fields to update
   */
  async update(id: string, data: MonthlyOverviewUpdate): Promise<MonthlyOverview> {
    await this.getUserId();

    // Validate date range if both dates are provided
    if (data.start_date && data.end_date) {
      if (new Date(data.end_date) < new Date(data.start_date)) {
        throw new ValidationError('End Date must be after Start Date', 'end_date');
      }
    }

    const { data: updated, error } = await this.supabase
      .from('monthly_overviews')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update monthly overview: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Monthly Overview', id);
    }

    return updated;
  }

  /**
   * Delete a monthly overview
   * This will cascade delete all related budgets, expenses, and income sources
   *
   * @param id - Monthly overview ID
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('monthly_overviews')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete monthly overview: ${error.message}`);
    }
  }

  /**
   * Delete multiple monthly overviews by ID.
   * Each must belong to the current user (enforced by RLS).
   */
  async deleteMany(ids: string[]): Promise<void> {
    await this.getUserId();
    if (ids.length === 0) return;

    const { error } = await this.supabase
      .from('monthly_overviews')
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to delete monthly overviews: ${error.message}`);
    }
  }

  /**
   * Get all budgets for a monthly overview with their summaries
   */
  async getBudgets(monthlyOverviewId: string) {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('budget_summary')
      .select('*')
      .eq('monthly_overview_id', monthlyOverviewId)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch budgets: ${error.message}`);
    }

    return data || [];
  }
}
