/**
 * Master Budget Service
 * 
 * Handles CRUD operations for master budgets (baseline budget categories).
 * Master budgets are copied to each new month when created.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, UnauthorizedError, ValidationError } from './errors';

export interface MasterBudget {
  id: string;
  user_id: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MasterBudgetInsert {
  id?: string;
  user_id?: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface MasterBudgetUpdate {
  name?: string;
  budget_amount?: number;
  description?: string | null;
  is_active?: boolean;
  display_order?: number;
}

/** Snapshot of a master budget row as stored in history (JSONB) */
export interface MasterBudgetHistorySnapshot {
  id: string;
  user_id: string;
  name: string;
  budget_amount: number;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type MasterBudgetHistoryAction = 'created' | 'updated' | 'deleted';

export interface MasterBudgetHistoryEntry {
  id: string;
  master_budget_id: string | null;
  user_id: string;
  action: MasterBudgetHistoryAction;
  old_data: MasterBudgetHistorySnapshot | null;
  new_data: MasterBudgetHistorySnapshot | null;
  changed_at: string;
}

export class MasterBudgetService {
  constructor(private supabase: SupabaseClient) {}

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error || !user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  /**
   * Get all master budgets for the current user
   * @param activeOnly - If true, only return active budgets
   */
  async getAll(activeOnly: boolean = false): Promise<MasterBudget[]> {
    const userId = await this.getUserId();

    let query = this.supabase
      .from('master_budgets')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch master budgets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single master budget by ID
   */
  async getById(id: string): Promise<MasterBudget> {
    const userId = await this.getUserId();

    const { data, error } = await this.supabase
      .from('master_budgets')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Master budget', id);
    }

    return data;
  }

  /**
   * Create a new master budget
   */
  async create(data: Omit<MasterBudgetInsert, 'user_id'>): Promise<MasterBudget> {
    const userId = await this.getUserId();

    // Validate budget amount
    if (data.budget_amount < 0) {
      throw new ValidationError('Budget amount cannot be negative', 'budget_amount');
    }

    if (!data.name.trim()) {
      throw new ValidationError('Budget name is required', 'name');
    }

    // Check for duplicate name
    const { data: existing } = await this.supabase
      .from('master_budgets')
      .select('id')
      .eq('user_id', userId)
      .eq('name', data.name.trim())
      .maybeSingle();

    if (existing) {
      throw new ValidationError(
        `A master budget named "${data.name.trim()}" already exists`,
        'name'
      );
    }

    // Get max display_order for ordering
    const { data: maxOrder } = await this.supabase
      .from('master_budgets')
      .select('display_order')
      .eq('user_id', userId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const { data: budget, error } = await this.supabase
      .from('master_budgets')
      .insert({
        ...data,
        user_id: userId,
        name: data.name.trim(),
        display_order: data.display_order ?? ((maxOrder?.display_order ?? 0) + 1),
        is_active: data.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ValidationError(
          `A master budget named "${data.name.trim()}" already exists`,
          'name'
        );
      }
      throw new Error(`Failed to create master budget: ${error.message}`);
    }

    return budget;
  }

  /**
   * Update an existing master budget
   */
  async update(id: string, data: MasterBudgetUpdate): Promise<MasterBudget> {
    const userId = await this.getUserId();

    // Verify ownership
    const existing = await this.getById(id);
    if (existing.user_id !== userId) {
      throw new UnauthorizedError();
    }

    // Validate budget amount if provided
    if (data.budget_amount !== undefined && data.budget_amount < 0) {
      throw new ValidationError('Budget amount cannot be negative', 'budget_amount');
    }

    // Check for duplicate name if name is being changed
    if (data.name && data.name.trim() !== existing.name) {
      const { data: duplicate } = await this.supabase
        .from('master_budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('name', data.name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        throw new ValidationError(
          `A master budget named "${data.name.trim()}" already exists`,
          'name'
        );
      }
    }

    const updateData: MasterBudgetUpdate = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.budget_amount !== undefined) updateData.budget_amount = data.budget_amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;

    const { data: budget, error } = await this.supabase
      .from('master_budgets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ValidationError(
          `A master budget named "${data.name?.trim()}" already exists`,
          'name'
        );
      }
      throw new Error(`Failed to update master budget: ${error.message}`);
    }

    return budget;
  }

  /**
   * Delete a master budget (soft delete by setting is_active = false)
   * Or hard delete if requested
   */
  async delete(id: string, hardDelete: boolean = false): Promise<void> {
    const userId = await this.getUserId();

    // Verify ownership
    await this.getById(id);

    if (hardDelete) {
      const { error } = await this.supabase
        .from('master_budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete master budget: ${error.message}`);
      }
    } else {
      // Soft delete
      const { error } = await this.supabase
        .from('master_budgets')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to deactivate master budget: ${error.message}`);
      }
    }
  }

  /**
   * Get total of all active master budgets
   */
  async getTotal(): Promise<number> {
    const budgets = await this.getAll(true);
    return budgets.reduce((sum, b) => sum + Number(b.budget_amount || 0), 0);
  }

  /**
   * Get history of changes to master budgets (create/update/delete).
   * @param options.limit - Max number of entries (default 50)
   * @param options.masterBudgetId - If set, only entries for this budget
   */
  async getHistory(options?: {
    limit?: number;
    masterBudgetId?: string;
  }): Promise<MasterBudgetHistoryEntry[]> {
    const userId = await this.getUserId();
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

    let query = this.supabase
      .from('master_budget_history')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (options?.masterBudgetId) {
      query = query.eq('master_budget_id', options.masterBudgetId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch master budget history: ${error.message}`);
    }

    return (data || []) as MasterBudgetHistoryEntry[];
  }
}
