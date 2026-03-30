/**
 * Debtor Service
 *
 * Handles all business logic for tracking people who owe the user money.
 * Supports partial repayment tracking with automatic balance updates via DB triggers.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Debtor,
  DebtorUpdate,
  DebtorPayment,
  DebtorPaymentUpdate,
  DebtorStatusType,
} from '@/lib/supabase/database.types';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

export class DebtorService {
  constructor(private supabase: SupabaseClient) {}

  private async getUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user.id;
  }

  async create(data: {
    debtor_name: string;
    amount_owed: number;
    date_lent: string;
    expected_repayment_date?: string | null;
    status?: DebtorStatusType;
    person?: string | null;
    bank?: string | null;
    payment_method?: string | null;
    description?: string | null;
    notes?: string | null;
  }): Promise<Debtor> {
    const userId = await this.getUserId();

    if (data.amount_owed <= 0) {
      throw new ValidationError('Amount owed must be greater than zero', 'amount_owed');
    }

    const { data: debtor, error } = await this.supabase
      .from('debtors')
      .insert({
        ...data,
        user_id: userId,
        amount_repaid: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create debtor: ${error.message}`);
    }

    return debtor;
  }

  async getAll(status?: DebtorStatusType): Promise<Debtor[]> {
    await this.getUserId();

    let query = this.supabase
      .from('debtors')
      .select('*')
      .order('date_lent', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch debtors: ${error.message}`);
    }

    return data || [];
  }

  async getActive(): Promise<Debtor[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('debtors')
      .select('*')
      .in('status', ['Active', 'Partially Paid'])
      .order('date_lent', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active debtors: ${error.message}`);
    }

    return data || [];
  }

  async getById(id: string): Promise<Debtor> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('debtors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Debtor', id);
    }

    return data;
  }

  async update(id: string, data: DebtorUpdate): Promise<Debtor> {
    await this.getUserId();

    if (data.amount_owed !== undefined && data.amount_owed <= 0) {
      throw new ValidationError('Amount owed must be greater than zero', 'amount_owed');
    }

    const { data: updated, error } = await this.supabase
      .from('debtors')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update debtor: ${error.message}`);
    }

    if (!updated) {
      throw new NotFoundError('Debtor', id);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('debtors')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete debtor: ${error.message}`);
    }
  }

  async markAsPaidOff(id: string): Promise<Debtor> {
    const debtor = await this.getById(id);
    return this.update(id, {
      status: 'Paid Off',
      amount_repaid: debtor.amount_owed,
    });
  }

  async markAsWrittenOff(id: string): Promise<Debtor> {
    return this.update(id, { status: 'Written Off' });
  }

  async getTotalOwed(): Promise<number> {
    const activeDebtors = await this.getActive();
    return activeDebtors.reduce(
      (total, debtor) => total + (Number(debtor.amount_owed) - Number(debtor.amount_repaid)),
      0
    );
  }

  // --- Payment Tracking ---

  async recordPayment(data: {
    debtor_id: string;
    payment_amount: number;
    payment_date: string;
    payment_method?: string | null;
    notes?: string | null;
  }): Promise<DebtorPayment> {
    const userId = await this.getUserId();

    if (data.payment_amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero', 'payment_amount');
    }

    // Check debtor exists and is not settled
    const debtor = await this.getById(data.debtor_id);
    if (debtor.status === 'Paid Off' || debtor.status === 'Written Off') {
      throw new ValidationError(
        'Cannot record payment for a debt that is paid off or written off',
        'debtor_id'
      );
    }

    const remainingBalance = Number(debtor.amount_owed) - Number(debtor.amount_repaid);
    if (data.payment_amount > remainingBalance + 0.01) {
      throw new ValidationError(
        `Payment amount (${data.payment_amount.toFixed(2)}) exceeds remaining balance (${remainingBalance.toFixed(2)})`,
        'payment_amount'
      );
    }

    const { data: payment, error } = await this.supabase
      .from('debtor_payments')
      .insert({
        ...data,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    return payment;
  }

  async getPayments(debtorId: string): Promise<DebtorPayment[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('debtor_payments')
      .select('*')
      .eq('debtor_id', debtorId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch debtor payments: ${error.message}`);
    }

    return data || [];
  }

  async updatePayment(id: string, data: DebtorPaymentUpdate): Promise<DebtorPayment> {
    await this.getUserId();

    if (data.payment_amount !== undefined && data.payment_amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero', 'payment_amount');
    }

    const { data: updated, error } = await this.supabase
      .from('debtor_payments')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    if (!updated) {
      throw new NotFoundError('Debtor Payment', id);
    }

    return updated;
  }

  async deletePayment(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('debtor_payments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete payment: ${error.message}`);
    }
  }
}
