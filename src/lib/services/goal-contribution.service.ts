/**
 * Goal Contribution Service
 * 
 * Handles all business logic for goal contributions.
 * Contributions are separate from expenses and track money allocated to financial goals.
 * 
 * Key Business Rules:
 * 1. Contribution amount must be positive
 * 2. Contribution date must be within the monthly overview date range
 * 3. Contribution cannot exceed available income (total income - total budgeted)
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  GoalContribution, 
  GoalContributionInsert, 
  GoalContributionUpdate,
  MonthlyOverview 
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';
import { logError } from '@/lib/utils/logger';

export class GoalContributionService {
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
   * Get monthly overview with income, budget, subscription, and contribution totals.
   * Available income = income - total budgets - total subscriptions - total contributions.
   */
  private async getMonthlyOverviewWithTotals(monthlyOverviewId: string): Promise<{
    overview: MonthlyOverview;
    totalIncome: number;
    totalBudgeted: number;
    availableIncome: number;
  }> {
    const { data: overview, error: overviewError } = await this.supabase
      .from('monthly_overviews')
      .select('*')
      .eq('id', monthlyOverviewId)
      .single();

    if (overviewError || !overview) {
      throw new NotFoundError('Monthly Overview', monthlyOverviewId);
    }

    // Get total income
    const { data: incomeSources, error: incomeError } = await this.supabase
      .from('income_sources')
      .select('amount')
      .eq('monthly_overview_id', monthlyOverviewId);

    if (incomeError) {
      logError(new Error(`Failed to fetch income sources: ${incomeError.message}`), {
        event: 'goal_contribution.get_income.failed',
        metadata: { monthlyOverviewId },
      });
    }

    const totalIncome = incomeSources?.reduce((sum, inc) => {
      const amount = typeof inc.amount === 'string' ? parseFloat(inc.amount) : Number(inc.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0) || 0;

    // Get total budgeted
    const { data: budgets, error: budgetsError } = await this.supabase
      .from('budgets')
      .select('budget_amount')
      .eq('monthly_overview_id', monthlyOverviewId);

    if (budgetsError) {
      logError(new Error(`Failed to fetch budgets: ${budgetsError.message}`), {
        event: 'goal_contribution.get_budgets.failed',
        metadata: { monthlyOverviewId },
      });
    }

    const totalBudgeted = budgets?.reduce((sum, b) => {
      const amount = typeof b.budget_amount === 'string' ? parseFloat(b.budget_amount) : Number(b.budget_amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0) || 0;

    // Get total contributions (already allocated to goals)
    const { data: existingContributions, error: contributionsError } = await this.supabase
      .from('goal_contributions')
      .select('amount')
      .eq('monthly_overview_id', monthlyOverviewId);

    if (contributionsError) {
      logError(new Error(`Failed to fetch contributions: ${contributionsError.message}`), {
        event: 'goal_contribution.get_contributions.failed',
        metadata: { monthlyOverviewId },
      });
    }

    const totalContributions = existingContributions?.reduce((sum, c) => {
      const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : Number(c.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0) || 0;

    // Total subscriptions due this month (monthly equivalent cost)
    let totalSubscriptions = 0;
    try {
      const { SubscriptionService } = await import('./subscription.service');
      const subscriptionService = new SubscriptionService(this.supabase);
      totalSubscriptions = await subscriptionService.getTotalMonthlyCostForDateRange(
        overview.start_date,
        overview.end_date
      );
    } catch {
      // Non-fatal; leave at 0
    }

    // Available income = income - total budgets - total subscriptions - total contributions
    const availableIncome = totalIncome - totalBudgeted - totalSubscriptions - totalContributions;

    return {
      overview,
      totalIncome,
      totalBudgeted,
      availableIncome,
    };
  }

  /**
   * Validate that the contribution date is within the monthly overview date range
   */
  private validateContributionDate(contributionDate: string, monthlyOverview: MonthlyOverview): void {
    const contribution = new Date(contributionDate);
    const start = new Date(monthlyOverview.start_date);
    const end = new Date(monthlyOverview.end_date);

    // Set times to midnight for date-only comparison
    contribution.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (contribution < start || contribution > end) {
      throw new ValidationError(
        `Contribution date must be between ${monthlyOverview.start_date} and ${monthlyOverview.end_date}`,
        'date'
      );
    }
  }

  /**
   * Validate that the contribution amount doesn't exceed available income
   */
  private validateAvailableIncome(
    availableIncome: number,
    contributionAmount: number,
    existingContributionAmount: number = 0
  ): void {
    // For updates: add back the existing amount, then subtract the new amount
    const projectedAvailable = availableIncome + existingContributionAmount - contributionAmount;

    if (projectedAvailable < 0) {
      throw new ValidationError(
        `Contribution amount exceeds available income. Available: ${availableIncome.toFixed(2)}, Attempted: ${contributionAmount.toFixed(2)}`,
        'amount'
      );
    }
  }

  /**
   * Create a new goal contribution
   * 
   * Validates:
   * 1. Amount is positive
   * 2. Date is within monthly overview range
   * 3. Amount doesn't exceed available income
   * 
   * @param monthlyOverviewId - The month this contribution belongs to
   * @param goalId - The goal being funded
   * @param data - Contribution data (amount, date, description, bank, notes)
   * @returns The created contribution
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
  ): Promise<GoalContribution> {
    const userId = await this.getUserId();

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new ValidationError('Contribution amount must be greater than zero', 'amount');
    }

    // Get monthly overview with totals
    const { overview, availableIncome } = await this.getMonthlyOverviewWithTotals(monthlyOverviewId);

    // Validate date is within monthly overview range
    this.validateContributionDate(data.date, overview);

    // Validate available income
    this.validateAvailableIncome(availableIncome, data.amount);

    // Verify goal exists and belongs to user
    const { data: goal, error: goalError } = await this.supabase
      .from('financial_goals')
      .select('id')
      .eq('id', goalId)
      .eq('user_id', userId)
      .single();

    if (goalError || !goal) {
      throw new NotFoundError('Financial Goal', goalId);
    }

    // Create the contribution
    // The trigger will automatically update the goal's current_amount
    const { data: contribution, error } = await this.supabase
      .from('goal_contributions')
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
      logError(new Error(`Failed to create goal contribution: ${error.message}`), {
        event: 'goal_contribution.create.failed',
        userId,
        metadata: { monthlyOverviewId, goalId, amount: data.amount },
      });
      throw new Error(`Failed to create goal contribution: ${error.message}`);
    }

    return contribution;
  }

  /**
   * Get all contributions for a specific goal
   * @param goalId - The goal ID
   * @returns Array of contributions
   */
  async getByGoal(goalId: string): Promise<GoalContribution[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('goal_contributions')
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
      logError(new Error(`Failed to fetch contributions for goal: ${error.message}`), {
        event: 'goal_contribution.get_by_goal.failed',
        metadata: { goalId },
      });
      throw new Error(`Failed to fetch contributions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all contributions for a specific month
   * @param monthlyOverviewId - The month ID
   * @returns Array of contributions with goal info
   */
  async getByMonth(monthlyOverviewId: string): Promise<(GoalContribution & {
    financial_goal: { id: string; name: string; target_amount: number };
  })[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('goal_contributions')
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
      logError(new Error(`Failed to fetch contributions for month: ${error.message}`), {
        event: 'goal_contribution.get_by_month.failed',
        metadata: { monthlyOverviewId },
      });
      throw new Error(`Failed to fetch contributions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update an existing contribution
   * 
   * Validates:
   * 1. Amount is positive
   * 2. Date is within monthly overview range
   * 3. Updated amount doesn't exceed available income
   * 
   * @param id - Contribution ID
   * @param data - Updated contribution data
   * @returns The updated contribution
   */
  async update(id: string, data: Partial<GoalContributionUpdate>): Promise<GoalContribution> {
    const userId = await this.getUserId();

    // Get existing contribution
    const { data: existing, error: fetchError } = await this.supabase
      .from('goal_contributions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Goal Contribution', id);
    }

    // Validate amount if being updated
    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        throw new ValidationError('Contribution amount must be greater than zero', 'amount');
      }

      // Get monthly overview with totals
      const { overview, availableIncome } = await this.getMonthlyOverviewWithTotals(existing.monthly_overview_id);

      // Validate available income (accounting for existing contribution)
      this.validateAvailableIncome(availableIncome, data.amount, Number(existing.amount));
    }

    // Validate date if being updated
    if (data.date !== undefined) {
      const { data: overview } = await this.supabase
        .from('monthly_overviews')
        .select('*')
        .eq('id', existing.monthly_overview_id)
        .single();

      if (overview) {
        this.validateContributionDate(data.date, overview);
      }
    }

    // Update the contribution
    // The trigger will automatically update the goal's current_amount
    const { data: contribution, error } = await this.supabase
      .from('goal_contributions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to update goal contribution: ${error.message}`), {
        event: 'goal_contribution.update.failed',
        userId,
        metadata: { contributionId: id },
      });
      throw new Error(`Failed to update contribution: ${error.message}`);
    }

    return contribution;
  }

  /**
   * Delete a contribution
   * The trigger will automatically update the goal's current_amount
   * 
   * @param id - Contribution ID
   */
  async delete(id: string): Promise<void> {
    const userId = await this.getUserId();

    // Verify contribution exists and belongs to user
    const { data: existing, error: fetchError } = await this.supabase
      .from('goal_contributions')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Goal Contribution', id);
    }

    // Delete the contribution
    // The trigger will automatically update the goal's current_amount
    const { error } = await this.supabase
      .from('goal_contributions')
      .delete()
      .eq('id', id);

    if (error) {
      logError(new Error(`Failed to delete goal contribution: ${error.message}`), {
        event: 'goal_contribution.delete.failed',
        userId,
        metadata: { contributionId: id },
      });
      throw new Error(`Failed to delete contribution: ${error.message}`);
    }
  }

  /**
   * Get available income for a month (total income - total budgeted - total contributions)
   * @param monthlyOverviewId - The month ID
   * @returns Available income amount
   */
  async getAvailableIncome(monthlyOverviewId: string): Promise<number> {
    await this.getUserId();

    const { availableIncome } = await this.getMonthlyOverviewWithTotals(monthlyOverviewId);
    return Math.max(0, availableIncome); // Don't return negative
  }
}
