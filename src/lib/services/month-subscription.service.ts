/**
 * Month Subscription Service
 *
 * Manages subscription snapshots per month.
 * When a past month is viewed, this service captures the subscription state
 * so that historical months remain accurate even if subscriptions are later edited.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  MonthSubscription,
  MonthSubscriptionInsert,
} from '@/lib/supabase/database.types';
import { SubscriptionService } from './subscription.service';

export class MonthSubscriptionService {
  constructor(private supabase: SupabaseClient) {}

  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return user.id;
  }

  /**
   * Check if a snapshot already exists for a given month.
   */
  async hasSnapshot(monthId: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('month_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('month_id', monthId);

    return (count ?? 0) > 0;
  }

  /**
   * Create a snapshot of subscriptions for a month.
   * Uses SubscriptionService.getForDateRange() to determine which subscriptions
   * are due within the month's date range, then stores them as immutable records.
   */
  async createSnapshot(
    monthId: string,
    startDate: string,
    endDate: string
  ): Promise<MonthSubscription[]> {
    const userId = await this.getUserId();
    const subscriptionService = new SubscriptionService(this.supabase);

    const results = await subscriptionService.getForDateRange(startDate, endDate);

    if (results.length === 0) return [];

    const inserts: MonthSubscriptionInsert[] = results.map(({ subscription, totalDue }) => ({
      month_id: monthId,
      subscription_id: subscription.id,
      user_id: userId,
      name: subscription.name,
      amount: subscription.amount,
      frequency: subscription.frequency,
      status: subscription.status,
      is_company_paid: subscription.is_company_paid,
      is_essential: subscription.is_essential,
      collection_day: subscription.collection_day,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      next_collection_date: subscription.next_collection_date,
      total_due: totalDue,
    }));

    const { data, error } = await this.supabase
      .from('month_subscriptions')
      .upsert(inserts, { onConflict: 'month_id,subscription_id' })
      .select();

    if (error) throw error;
    return data || [];
  }

  /**
   * Retrieve the snapshot for a month, formatted to match the shape
   * used by getForDateRange() for UI compatibility.
   */
  async getSnapshot(monthId: string): Promise<Array<{ subscription: MonthSubscription; totalDue: number }>> {
    const { data, error } = await this.supabase
      .from('month_subscriptions')
      .select('*')
      .eq('month_id', monthId)
      .order('name');

    if (error) throw error;

    return (data || []).map(ms => ({
      subscription: ms,
      totalDue: ms.total_due,
    }));
  }

  /**
   * Get total subscription cost from a snapshot.
   */
  async getTotalFromSnapshot(monthId: string, excludeCompanyPaid?: boolean): Promise<number> {
    const { data, error } = await this.supabase
      .from('month_subscriptions')
      .select('total_due, is_company_paid')
      .eq('month_id', monthId);

    if (error) throw error;

    return (data || [])
      .filter(ms => excludeCompanyPaid ? !ms.is_company_paid : true)
      .reduce((sum, ms) => sum + Number(ms.total_due), 0);
  }
}
