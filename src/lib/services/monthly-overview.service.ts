/**
 * Monthly Overview Service
 * 
 * Handles all business logic for monthly budget periods.
 * 
 * Key Business Rules:
 * 1. Auto-create 13 default budget categories when a month is created
 *    (Replicates Salesforce Flow: Budget_Automation)
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  MonthlyOverview, 
  MonthlyOverviewInsert, 
  MonthlyOverviewUpdate,
  BudgetInsert 
} from '@/lib/supabase/database.types';
import { NotFoundError, UnauthorizedError, ValidationError } from './errors';
import { logMonthCreated, logError } from '@/lib/utils/logger';

/**
 * Default budget categories automatically created for each new month
 * Replicates the Salesforce Flow "Budget_Automation"
 * Total Default Monthly Budget: €4,588.00
 */
const DEFAULT_BUDGET_CATEGORIES: Omit<BudgetInsert, 'monthly_overview_id'>[] = [
  { name: 'Tithe', budget_amount: 350.00, description: '10% of all income - giving back to God' },
  { name: 'Offering', budget_amount: 175.00, description: '5% of main income - additional giving' },
  { name: 'Housing', budget_amount: 2228.00, description: 'Rent, Electricity' },
  { name: 'Food', budget_amount: 350.00, description: 'Groceries & Snacks' },
  { name: 'Transport', budget_amount: 200.00, description: 'Toll, Parking, Fuel' },
  { name: 'Personal Care', budget_amount: 480.00, description: 'Personal allowances, Nails' },
  { name: 'Household', budget_amount: 130.00, description: 'Household items, Cleaning' },
  { name: 'Savings', budget_amount: 300.00, description: 'Monthly savings' },
  { name: 'Investments', budget_amount: 100.00, description: '401K, Stocks, Retirement contributions' },
  { name: 'Subscriptions', budget_amount: 75.00, description: 'Netflix, Spotify, and other recurring subscriptions' },
  { name: 'Health', budget_amount: 50.00, description: 'Medicine or health related' },
  { name: 'Travel', budget_amount: 50.00, description: 'Travel Allowance' },
  { name: 'Miscellaneous', budget_amount: 100.00, description: 'Unexpected expenses and other items' },
];

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
   * Create a new monthly overview with default budget categories
   * 
   * Business Rule: Auto-create 13 default budget categories
   * This replicates the Salesforce Flow "Budget_Automation"
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

    // Default budgets are automatically created by database trigger
    // No need to create them manually here to avoid duplicates

    // Get count of budgets created (by trigger)
    // Wait a moment for trigger to complete, then check
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { count, error: countError } = await this.supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('monthly_overview_id', monthlyOverview.id);
    
    // If budgets table doesn't exist, log warning but don't fail
    if (countError && (countError.message.includes('does not exist') || countError.code === '42P01')) {
      console.warn('Budgets table does not exist. Please run the database schema migration.');
    }

    // Log successful month creation
    logMonthCreated({
      monthlyOverviewId: monthlyOverview.id,
      userId,
      name: monthlyOverview.name,
      startDate: monthlyOverview.start_date,
      endDate: monthlyOverview.end_date,
      budgetsCreated: count || DEFAULT_BUDGET_CATEGORIES.length,
    });

    return monthlyOverview;
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

/**
 * Export the default budget categories for reference
 */
export { DEFAULT_BUDGET_CATEGORIES };
