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
import { MasterBudgetService } from './master-budget.service';
import { BudgetService } from './budget.service';

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

    // Auto-create budgets from master budgets if this is the first income for this month
    // Check if any budgets exist for this month
    const { data: existingBudgets, error: budgetCheckError } = await this.supabase
      .from('budgets')
      .select('id')
      .eq('monthly_overview_id', incomeSource.monthly_overview_id)
      .limit(1);

    // Only create budgets if none exist yet
    if (!budgetCheckError && (!existingBudgets || existingBudgets.length === 0)) {
      try {
        const masterBudgetService = new MasterBudgetService(this.supabase);
        const budgetService = new BudgetService(this.supabase);
        
        // Get all active master budgets for this user
        const masterBudgets = await masterBudgetService.getAll(true);
        
        // Create budgets from master budgets
        for (const masterBudget of masterBudgets) {
          try {
            await budgetService.create({
              monthly_overview_id: incomeSource.monthly_overview_id,
              name: masterBudget.name,
              budget_amount: masterBudget.budget_amount,
              master_budget_id: masterBudget.id,
              description: masterBudget.description || null,
            });
          } catch (err) {
            // Skip if budget already exists or other error
            console.warn(`Failed to create budget from master budget ${masterBudget.name}:`, err);
          }
        }
      } catch (err) {
        // Don't fail income creation if budget creation fails
        console.error('Failed to auto-create budgets from master budgets:', err);
      }
    }

    // If tithe/offering is selected, ensure Tithe and Offering budgets exist with calculated amounts (10% and 5%); no expenses created
    if (incomeSource.tithe_deduction) {
      const titheAmount = incomeSource.amount * 0.1;
      const offeringAmount = incomeSource.amount * 0.05;
      try {
        const budgetService = new BudgetService(this.supabase);
        const masterBudgetService = new MasterBudgetService(this.supabase);

        // Tithe budget: create or add 10% of this income to existing
        const { data: titheBudget } = await this.supabase
          .from('budgets')
          .select('id, budget_amount')
          .eq('monthly_overview_id', incomeSource.monthly_overview_id)
          .eq('name', 'Tithe')
          .maybeSingle();

        if (titheBudget) {
          const newAmount = Number(titheBudget.budget_amount ?? 0) + titheAmount;
          await this.supabase.from('budgets').update({ budget_amount: newAmount }).eq('id', titheBudget.id);
        } else {
          const masterBudgets = await masterBudgetService.getAll(true);
          const titheMaster = masterBudgets.find(mb => mb.name.toLowerCase() === 'tithe');
          if (titheMaster) {
            try {
              await budgetService.create({
                monthly_overview_id: incomeSource.monthly_overview_id,
                name: titheMaster.name,
                budget_amount: titheAmount,
                master_budget_id: titheMaster.id,
                description: titheMaster.description || null,
              });
            } catch (err) {
              console.warn('Failed to create Tithe budget from master:', err);
            }
          } else {
            try {
              await budgetService.create({
                monthly_overview_id: incomeSource.monthly_overview_id,
                name: 'Tithe',
                budget_amount: titheAmount,
                description: '10% of all income - giving back to God',
              });
            } catch (err) {
              console.warn('Failed to create Tithe budget:', err);
            }
          }
        }

        // Offering budget: create or add 5% of this income to existing
        const { data: offeringBudget } = await this.supabase
          .from('budgets')
          .select('id, budget_amount')
          .eq('monthly_overview_id', incomeSource.monthly_overview_id)
          .eq('name', 'Offering')
          .maybeSingle();

        if (offeringBudget) {
          const newAmount = Number(offeringBudget.budget_amount ?? 0) + offeringAmount;
          await this.supabase.from('budgets').update({ budget_amount: newAmount }).eq('id', offeringBudget.id);
        } else {
          const masterBudgets = await masterBudgetService.getAll(true);
          const offeringMaster = masterBudgets.find(mb => mb.name.toLowerCase() === 'offering');
          if (offeringMaster) {
            try {
              await budgetService.create({
                monthly_overview_id: incomeSource.monthly_overview_id,
                name: offeringMaster.name,
                budget_amount: offeringAmount,
                master_budget_id: offeringMaster.id,
                description: offeringMaster.description || null,
              });
            } catch (err) {
              console.warn('Failed to create Offering budget from master:', err);
            }
          } else {
            try {
              await budgetService.create({
                monthly_overview_id: incomeSource.monthly_overview_id,
                name: 'Offering',
                budget_amount: offeringAmount,
                description: '5% of main income - additional giving',
              });
            } catch (err) {
              console.warn('Failed to create Offering budget:', err);
            }
          }
        }
      } catch (err) {
        // Don't fail income creation if budget creation fails
        console.error('Failed to create/update Tithe/Offering budgets:', err);
      }
    }

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
   * Delete an income source.
   * If the income had tithe_deduction, subtracts 10% from Tithe budget and 5% from Offering budget for that month (rebalance).
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const income = await this.getById(id);
    const monthlyOverviewId = income.monthly_overview_id;

    if (income.tithe_deduction && income.amount > 0) {
      const titheAmount = income.amount * 0.1;
      const offeringAmount = income.amount * 0.05;
      try {
        const { data: titheBudget } = await this.supabase
          .from('budgets')
          .select('id, budget_amount')
          .eq('monthly_overview_id', monthlyOverviewId)
          .eq('name', 'Tithe')
          .maybeSingle();

        if (titheBudget && Number(titheBudget.budget_amount ?? 0) > 0) {
          const newAmount = Math.max(0, Number(titheBudget.budget_amount ?? 0) - titheAmount);
          await this.supabase.from('budgets').update({ budget_amount: newAmount }).eq('id', titheBudget.id);
        }

        const { data: offeringBudget } = await this.supabase
          .from('budgets')
          .select('id, budget_amount')
          .eq('monthly_overview_id', monthlyOverviewId)
          .eq('name', 'Offering')
          .maybeSingle();

        if (offeringBudget && Number(offeringBudget.budget_amount ?? 0) > 0) {
          const newAmount = Math.max(0, Number(offeringBudget.budget_amount ?? 0) - offeringAmount);
          await this.supabase.from('budgets').update({ budget_amount: newAmount }).eq('id', offeringBudget.id);
        }
      } catch (err) {
        console.error('Failed to rebalance Tithe/Offering on income delete:', err);
      }
    }

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
