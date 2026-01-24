/**
 * Income Source Service
 * 
 * Handles all business logic for income source records.
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  IncomeSource, 
  IncomeSourceInsert, 
  IncomeSourceUpdate,
  MonthlyOverview 
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';
import { logIncomeCreated, logError } from '@/lib/utils/logger';

export class IncomeSourceService {
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
   * Get monthly overview for validation
   */
  private async getMonthlyOverview(id: string): Promise<MonthlyOverview> {
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
   * Create a new income source
   * 
   * @param data - Income source data
   */
  async create(data: Omit<IncomeSourceInsert, 'user_id'>): Promise<IncomeSource> {
    const userId = await this.getUserId();

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new ValidationError('Income amount must be greater than zero', 'amount');
    }

    // Verify monthly overview exists and belongs to user
    await this.getMonthlyOverview(data.monthly_overview_id);

    const { data: incomeSource, error } = await this.supabase
      .from('income_sources')
      .insert({
        ...data,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to create income source: ${error.message}`), {
        event: 'income.create.failed',
        userId,
        metadata: { monthlyOverviewId: data.monthly_overview_id, amount: data.amount },
      });
      throw new Error(`Failed to create income source: ${error.message}`);
    }

    // Log successful income creation
    logIncomeCreated({
      incomeId: incomeSource.id,
      userId,
      amount: incomeSource.amount,
      monthlyOverviewId: incomeSource.monthly_overview_id,
      source: incomeSource.source,
      person: incomeSource.person,
      datePaid: incomeSource.date_paid,
      titheDeduction: incomeSource.tithe_deduction || false,
    });

    return incomeSource;
  }

  /**
   * Get all income sources for the current user
   * @param monthlyOverviewId - Optional filter by monthly overview
   */
  async getAll(monthlyOverviewId?: string): Promise<IncomeSource[]> {
    await this.getUserId();

    let query = this.supabase
      .from('income_sources')
      .select('*')
      .order('date_paid', { ascending: false });

    if (monthlyOverviewId) {
      query = query.eq('monthly_overview_id', monthlyOverviewId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch income sources: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get income sources for a specific monthly overview
   */
  async getByMonthlyOverview(monthlyOverviewId: string): Promise<IncomeSource[]> {
    return this.getAll(monthlyOverviewId);
  }

  /**
   * Get a single income source by ID
   */
  async getById(id: string): Promise<IncomeSource> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('income_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Income Source', id);
    }

    return data;
  }

  /**
   * Update an income source
   */
  async update(id: string, data: IncomeSourceUpdate): Promise<IncomeSource> {
    await this.getUserId();

    // Validate amount if provided
    if (data.amount !== undefined && data.amount <= 0) {
      throw new ValidationError('Income amount must be greater than zero', 'amount');
    }

    const { data: updated, error } = await this.supabase
      .from('income_sources')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update income source: ${error.message}`);
    }

    if ( !updated) {
      throw new NotFoundError('Income Source', id);
    }

    return updated;
  }

  /**
   * Delete an income source
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('income_sources')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete income source: ${error.message}`);
    }
  }

  /**
   * Get total income for a monthly overview
   */
  async getTotalForMonth(monthlyOverviewId: string): Promise<number> {
    const incomeSources = await this.getByMonthlyOverview(monthlyOverviewId);
    return incomeSources.reduce((sum, income) => sum + Number(income.amount), 0);
  }

  /**
   * Get income by person
   */
  async getByPerson(person: string, monthlyOverviewId?: string): Promise<IncomeSource[]> {
    await this.getUserId();

    let query = this.supabase
      .from('income_sources')
      .select('*')
      .eq('person', person)
      .order('date_paid', { ascending: false });

    if (monthlyOverviewId) {
      query = query.eq('monthly_overview_id', monthlyOverviewId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch income sources: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get income summary by person for a monthly overview
   */
  async getIncomeByPersonSummary(monthlyOverviewId: string): Promise<Record<string, number>> {
    const incomeSources = await this.getByMonthlyOverview(monthlyOverviewId);
    
    return incomeSources.reduce((acc, income) => {
      const person = income.person || 'Unknown';
      acc[person] = (acc[person] || 0) + Number(income.amount);
      return acc;
    }, {} as Record<string, number>);
  }
}
