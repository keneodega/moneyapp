/**
 * Savings Service
 * 
 * Handles all business logic for savings buckets and transactions.
 * 
 * @author Anthony Barrow anthony@mopsy-studio.com
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError, NotFoundError, ValidationError } from './errors';

export interface SavingsBucket {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | null;
  current_amount: number;
  linked_goal_id: string | null;
  monthly_contribution: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsBucketInsert {
  name: string;
  target_amount?: number | null;
  current_amount?: number;
  linked_goal_id?: string | null;
  monthly_contribution?: number | null;
  description?: string | null;
}

export interface SavingsBucketUpdate {
  name?: string;
  target_amount?: number | null;
  current_amount?: number;
  linked_goal_id?: string | null;
  monthly_contribution?: number | null;
  description?: string | null;
}

export interface SavingsTransaction {
  id: string;
  savings_bucket_id: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  date: string;
  description: string | null;
  linked_expense_id: string | null;
  created_at: string;
}

export interface SavingsTransactionInsert {
  savings_bucket_id: string;
  amount: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  date: string;
  description?: string | null;
  linked_expense_id?: string | null;
}

export interface SavingsBucketWithGoal extends SavingsBucket {
  linked_goal?: {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
  } | null;
}

export class SavingsService {
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
   * Create a new savings bucket
   */
  async createBucket(data: SavingsBucketInsert): Promise<SavingsBucket> {
    const userId = await this.getUserId();

    // Validate name
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Bucket name is required', 'name');
    }

    // Validate amounts
    if (data.target_amount !== null && data.target_amount !== undefined && data.target_amount < 0) {
      throw new ValidationError('Target amount must be non-negative', 'target_amount');
    }

    if (data.monthly_contribution !== null && data.monthly_contribution !== undefined && data.monthly_contribution < 0) {
      throw new ValidationError('Monthly contribution must be non-negative', 'monthly_contribution');
    }

    const { data: bucket, error } = await this.supabase
      .from('savings_buckets')
      .insert({
        ...data,
        name: data.name.trim(),
        user_id: userId,
        current_amount: data.current_amount || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create savings bucket: ${error.message}`);
    }

    return bucket;
  }

  /**
   * Get all savings buckets for the current user
   */
  async getAllBuckets(): Promise<SavingsBucketWithGoal[]> {
    await this.getUserId();

    const { data: buckets, error } = await this.supabase
      .from('savings_buckets')
      .select(`
        *,
        linked_goal:financial_goals(
          id,
          name,
          target_amount,
          current_amount
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch savings buckets: ${error.message}`);
    }

    return buckets?.map((bucket: any) => ({
      ...bucket,
      linked_goal: bucket.linked_goal?.[0] || null,
    })) || [];
  }

  /**
   * Get a single savings bucket by ID
   */
  async getBucketById(id: string): Promise<SavingsBucketWithGoal> {
    await this.getUserId();

    const { data: bucket, error } = await this.supabase
      .from('savings_buckets')
      .select(`
        *,
        linked_goal:financial_goals(
          id,
          name,
          target_amount,
          current_amount
        )
      `)
      .eq('id', id)
      .single();

    if (error || !bucket) {
      throw new NotFoundError('Savings bucket', id);
    }

    return {
      ...bucket,
      linked_goal: bucket.linked_goal?.[0] || null,
    };
  }

  /**
   * Update a savings bucket
   */
  async updateBucket(id: string, data: SavingsBucketUpdate): Promise<SavingsBucket> {
    await this.getUserId();

    // Validate amounts if provided
    if (data.target_amount !== null && data.target_amount !== undefined && data.target_amount < 0) {
      throw new ValidationError('Target amount must be non-negative', 'target_amount');
    }

    if (data.monthly_contribution !== null && data.monthly_contribution !== undefined && data.monthly_contribution < 0) {
      throw new ValidationError('Monthly contribution must be non-negative', 'monthly_contribution');
    }

    const updateData: any = { ...data };
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    const { data: bucket, error } = await this.supabase
      .from('savings_buckets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !bucket) {
      throw new NotFoundError('Savings bucket', id);
    }

    return bucket;
  }

  /**
   * Delete a savings bucket
   */
  async deleteBucket(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('savings_buckets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete savings bucket: ${error.message}`);
    }
  }

  /**
   * Create a savings transaction
   */
  async createTransaction(data: SavingsTransactionInsert): Promise<SavingsTransaction> {
    await this.getUserId();

    // Validate amount
    if (!data.amount || data.amount <= 0) {
      throw new ValidationError('Transaction amount must be greater than zero', 'amount');
    }

    // Verify bucket exists and belongs to user
    await this.getBucketById(data.savings_bucket_id);

    const { data: transaction, error } = await this.supabase
      .from('savings_transactions')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return transaction;
  }

  /**
   * Get all transactions for a bucket
   */
  async getBucketTransactions(bucketId: string): Promise<SavingsTransaction[]> {
    await this.getUserId();

    // Verify bucket exists and belongs to user
    await this.getBucketById(bucketId);

    const { data: transactions, error } = await this.supabase
      .from('savings_transactions')
      .select('*')
      .eq('savings_bucket_id', bucketId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return transactions || [];
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('savings_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  }

  /**
   * Get total savings across all buckets
   */
  async getTotalSavings(): Promise<number> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('savings_buckets')
      .select('current_amount');

    if (error) {
      throw new Error(`Failed to calculate total savings: ${error.message}`);
    }

    return data?.reduce((sum, bucket) => sum + (bucket.current_amount || 0), 0) || 0;
  }
}
