/**
 * Life Event Service
 *
 * Handles all data operations for life events used in financial forecasting.
 * Life events represent planned future milestones (baby, property purchase, car change, etc.)
 * and their expected financial impact.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  LifeEvent,
  LifeEventInsert,
  LifeEventUpdate,
} from '@/lib/supabase/database.types';
import {
  NotFoundError,
  UnauthorizedError,
} from './errors';

export class LifeEventService {
  constructor(private supabase: SupabaseClient) {}

  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get all life events for the current user, ordered by expected date
   */
  async getAll(): Promise<LifeEvent[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from('life_events')
      .select('*')
      .eq('user_id', userId)
      .order('expected_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single life event by ID
   * @throws NotFoundError if the event does not exist or belongs to another user
   */
  async getById(id: string): Promise<LifeEvent> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from('life_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Life event', id);
    }
    return data;
  }

  /**
   * Create a new life event
   */
  async create(data: Omit<LifeEventInsert, 'user_id'>): Promise<LifeEvent> {
    const userId = await this.getUserId();
    const { data: created, error } = await this.supabase
      .from('life_events')
      .insert({ ...data, user_id: userId })
      .select()
      .single();

    if (error || !created) throw error ?? new Error('Failed to create life event');
    return created;
  }

  /**
   * Update an existing life event
   * @throws NotFoundError if the event does not exist
   */
  async update(id: string, data: LifeEventUpdate): Promise<LifeEvent> {
    const userId = await this.getUserId();
    const { data: updated, error } = await this.supabase
      .from('life_events')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updated) {
      throw new NotFoundError('Life event', id);
    }
    return updated;
  }

  /**
   * Delete a life event
   */
  async delete(id: string): Promise<void> {
    const userId = await this.getUserId();
    const { error } = await this.supabase
      .from('life_events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Get the user's savings goals for the linked_goal dropdown
   */
  async getGoals(): Promise<Array<{ id: string; name: string }>> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase
      .from('financial_goals')
      .select('id, name')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
