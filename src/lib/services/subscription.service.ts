/**
 * Subscription Service
 * 
 * Handles all business logic for recurring subscriptions.
 * 
 * Key Features:
 * 1. Track recurring payments (Netflix, Spotify, etc.)
 * 2. Calculate monthly/yearly costs
 * 3. Track next collection dates
 * 4. Filter by status (Active, Paused, Cancelled)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Subscription, 
  SubscriptionInsert, 
  SubscriptionUpdate,
  FrequencyType,
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';

export class SubscriptionService {
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
   * Calculate the next collection date based on frequency and collection day
   */
  private calculateNextCollectionDate(
    frequency: FrequencyType,
    collectionDay?: number | null,
    lastCollection?: string | null
  ): string {
    const today = new Date();
    let nextDate = new Date();

    if (lastCollection) {
      nextDate = new Date(lastCollection);
    }

    switch (frequency) {
      case 'Weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'Bi-Weekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'Monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (collectionDay) {
          nextDate.setDate(Math.min(collectionDay, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        }
        break;
      case 'Quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'Bi-Annually':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'Annually':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        break;
    }

    // If next date is in the past, move to next period
    while (nextDate < today) {
      switch (frequency) {
        case 'Weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'Bi-Weekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'Monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'Quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'Bi-Annually':
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'Annually':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          break;
      }
    }

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Calculate monthly equivalent cost
   */
  static calculateMonthlyCost(amount: number, frequency: FrequencyType): number {
    switch (frequency) {
      case 'Weekly':
        return amount * 4.33; // Average weeks per month
      case 'Bi-Weekly':
        return amount * 2.17;
      case 'Monthly':
        return amount;
      case 'Quarterly':
        return amount / 3;
      case 'Bi-Annually':
        return amount / 6;
      case 'Annually':
        return amount / 12;
      case 'One-Time':
        return 0; // One-time payments don't count toward monthly
      default:
        return amount;
    }
  }

  /**
   * Calculate yearly equivalent cost
   */
  static calculateYearlyCost(amount: number, frequency: FrequencyType): number {
    switch (frequency) {
      case 'Weekly':
        return amount * 52;
      case 'Bi-Weekly':
        return amount * 26;
      case 'Monthly':
        return amount * 12;
      case 'Quarterly':
        return amount * 4;
      case 'Bi-Annually':
        return amount * 2;
      case 'Annually':
        return amount;
      case 'One-Time':
        return amount;
      default:
        return amount * 12;
    }
  }

  /**
   * Create a new subscription
   */
  async create(data: Omit<SubscriptionInsert, 'user_id'>): Promise<Subscription> {
    const userId = await this.getUserId();

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new ValidationError('Subscription amount must be greater than zero', 'amount');
    }

    // Validate collection day
    if (data.collection_day !== undefined && data.collection_day !== null) {
      if (data.collection_day < 1 || data.collection_day > 31) {
        throw new ValidationError('Collection day must be between 1 and 31', 'collection_day');
      }
    }

    // Calculate next collection date if not provided
    const nextCollectionDate = data.next_collection_date || 
      this.calculateNextCollectionDate(data.frequency, data.collection_day, data.start_date);

    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .insert({
        ...data,
        user_id: userId,
        next_collection_date: nextCollectionDate,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return subscription;
  }

  /**
   * Get all subscriptions for the current user
   */
  async getAll(status?: string, isEssential?: boolean): Promise<Subscription[]> {
    await this.getUserId();

    let query = this.supabase
      .from('subscriptions')
      .select('*')
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (isEssential !== undefined) {
      query = query.eq('is_essential', isEssential);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get essential subscriptions only
   */
  async getEssential(): Promise<Subscription[]> {
    return this.getAll('Active', true);
  }

  /**
   * Get non-essential subscriptions only
   */
  async getNonEssential(): Promise<Subscription[]> {
    return this.getAll('Active', false);
  }

  /**
   * Get active subscriptions only
   */
  async getActive(): Promise<Subscription[]> {
    return this.getAll('Active');
  }

  /**
   * Get a single subscription by ID
   */
  async getById(id: string): Promise<Subscription> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Subscription', id);
    }

    return data;
  }

  /**
   * Update a subscription
   */
  async update(id: string, data: SubscriptionUpdate): Promise<Subscription> {
    await this.getUserId();

    // Validate amount if provided
    if (data.amount !== undefined && data.amount <= 0) {
      throw new ValidationError('Subscription amount must be greater than zero', 'amount');
    }

    // Validate collection day if provided
    if (data.collection_day !== undefined && data.collection_day !== null) {
      if (data.collection_day < 1 || data.collection_day > 31) {
        throw new ValidationError('Collection day must be between 1 and 31', 'collection_day');
      }
    }

    const { data: updated, error } = await this.supabase
      .from('subscriptions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    if (!updated) {
      throw new NotFoundError('Subscription', id);
    }

    return updated;
  }

  /**
   * Delete a subscription
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }

  /**
   * Mark subscription as paid for current period
   */
  async markAsPaid(id: string): Promise<Subscription> {
    await this.getUserId();

    const subscription = await this.getById(id);
    const today = new Date().toISOString().split('T')[0];
    const nextCollection = this.calculateNextCollectionDate(
      subscription.frequency,
      subscription.collection_day,
      today
    );

    return this.update(id, {
      paid_this_period: true,
      last_collection_date: today,
      next_collection_date: nextCollection,
    });
  }

  /**
   * Pause a subscription
   */
  async pause(id: string): Promise<Subscription> {
    return this.update(id, { status: 'Paused' });
  }

  /**
   * Resume a paused subscription
   */
  async resume(id: string): Promise<Subscription> {
    return this.update(id, { status: 'Active' });
  }

  /**
   * Cancel a subscription
   */
  async cancel(id: string): Promise<Subscription> {
    const today = new Date().toISOString().split('T')[0];
    return this.update(id, { 
      status: 'Cancelled',
      end_date: today,
    });
  }

  /**
   * Get subscriptions due soon (within next 7 days)
   */
  async getDueSoon(): Promise<Subscription[]> {
    await this.getUserId();

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'Active')
      .gte('next_collection_date', today.toISOString().split('T')[0])
      .lte('next_collection_date', nextWeek.toISOString().split('T')[0])
      .order('next_collection_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get total monthly cost of active subscriptions
   */
  async getTotalMonthlyCost(): Promise<number> {
    const activeSubscriptions = await this.getActive();
    return activeSubscriptions.reduce((total, sub) => {
      return total + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
    }, 0);
  }

  /**
   * Get total yearly cost of active subscriptions
   */
  async getTotalYearlyCost(): Promise<number> {
    const activeSubscriptions = await this.getActive();
    return activeSubscriptions.reduce((total, sub) => {
      return total + SubscriptionService.calculateYearlyCost(sub.amount, sub.frequency);
    }, 0);
  }

  /**
   * Get subscriptions due within a date range (based on next_collection_date)
   */
  async getByDateRange(startDate: string, endDate: string, status?: string): Promise<Subscription[]> {
    await this.getUserId();

    let query = this.supabase
      .from('subscriptions')
      .select('*')
      .not('next_collection_date', 'is', null)
      .gte('next_collection_date', startDate)
      .lte('next_collection_date', endDate)
      .order('next_collection_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch subscriptions by date range: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Calculate total monthly cost for subscriptions due within a date range
   */
  async getTotalMonthlyCostForDateRange(startDate: string, endDate: string): Promise<number> {
    const subscriptions = await this.getByDateRange(startDate, endDate, 'Active');
    return subscriptions.reduce((total, sub) => {
      return total + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
    }, 0);
  }

  /**
   * Create budget entries from subscriptions for a specific month
   * Each subscription becomes a budget category with its monthly equivalent cost
   */
  async createBudgetsFromSubscriptions(
    monthlyOverviewId: string,
    startDate: string,
    endDate: string,
    subscriptionIds?: string[]
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    await this.getUserId();

    // Get subscriptions due in this date range
    let subscriptions = await this.getByDateRange(startDate, endDate, 'Active');

    // Filter by subscription IDs if provided
    if (subscriptionIds && subscriptionIds.length > 0) {
      subscriptions = subscriptions.filter(sub => subscriptionIds.includes(sub.id));
    }

    const { BudgetService } = await import('./budget.service');
    const budgetService = new BudgetService(this.supabase);

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Create a budget for each subscription
    for (const subscription of subscriptions) {
      try {
        const monthlyCost = SubscriptionService.calculateMonthlyCost(
          subscription.amount,
          subscription.frequency
        );

        // Check if budget already exists with this name
        const existingBudgets = await budgetService.getByMonthlyOverview(monthlyOverviewId);
        const existingBudget = existingBudgets.find(
          b => b.name.toLowerCase() === subscription.name.toLowerCase()
        );

        if (existingBudget) {
          results.skipped++;
          continue;
        }

        // Create budget entry
        await budgetService.create({
          monthly_overview_id: monthlyOverviewId,
          name: subscription.name,
          budget_amount: monthlyCost,
          description: `Subscription: ${subscription.name} (${subscription.frequency}) - Due: ${subscription.next_collection_date || 'N/A'}`,
        });

        results.created++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${subscription.name}: ${errorMsg}`);
      }
    }

    return results;
  }
}
