/**
 * Loan Service
 * 
 * Handles all business logic for loans and debts.
 * 
 * Key Features:
 * 1. Track loans (mortgage, car loans, personal loans, etc.)
 * 2. Calculate monthly payments and remaining balance
 * 3. Track loan payments with principal/interest breakdown
 * 4. Calculate total debt and payment obligations
 * 5. Filter by status, type, person
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Loan, 
  LoanInsert, 
  LoanUpdate,
  LoanPayment,
  LoanPaymentInsert,
  LoanPaymentUpdate,
  LoanStatusType,
  LoanType,
  FrequencyType,
} from '@/lib/supabase/database.types';
import { 
  NotFoundError, 
  UnauthorizedError,
  ValidationError 
} from './errors';

export class LoanService {
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
   * Calculate monthly equivalent payment based on frequency
   */
  static calculateMonthlyPayment(paymentAmount: number, frequency: FrequencyType): number {
    switch (frequency) {
      case 'Weekly':
        return paymentAmount * 4.33; // Average weeks per month
      case 'Bi-Weekly':
        return paymentAmount * 2.17;
      case 'Monthly':
        return paymentAmount;
      case 'Quarterly':
        return paymentAmount / 3;
      case 'Bi-Annually':
        return paymentAmount / 6;
      case 'Annually':
        return paymentAmount / 12;
      case 'One-Time':
        return 0;
      default:
        return paymentAmount;
    }
  }

  /**
   * Calculate next payment date based on frequency
   */
  private calculateNextPaymentDate(
    frequency: FrequencyType,
    lastPaymentDate?: string | null,
    startDate?: string
  ): string {
    const today = new Date();
    let nextDate = new Date();

    if (lastPaymentDate) {
      nextDate = new Date(lastPaymentDate);
    } else if (startDate) {
      nextDate = new Date(startDate);
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
   * Calculate estimated months remaining to pay off loan
   */
  static calculateMonthsRemaining(
    currentBalance: number,
    monthlyPayment: number,
    interestRate: number
  ): number {
    if (monthlyPayment <= 0 || currentBalance <= 0) {
      return 0;
    }

    // Simple calculation: if no interest, just divide
    if (interestRate === 0) {
      return Math.ceil(currentBalance / monthlyPayment);
    }

    // With interest: use amortization formula
    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    // Solving for n (number of payments)
    const monthlyRate = interestRate / 100 / 12;
    
    if (monthlyRate === 0) {
      return Math.ceil(currentBalance / monthlyPayment);
    }

    // Rearranged formula: n = -log(1 - (P*r)/M) / log(1+r)
    const numerator = Math.log(1 - (currentBalance * monthlyRate) / monthlyPayment);
    const denominator = Math.log(1 + monthlyRate);
    
    if (numerator <= 0 || denominator <= 0) {
      return Math.ceil(currentBalance / monthlyPayment); // Fallback
    }

    return Math.ceil(-numerator / denominator);
  }

  /**
   * Calculate total interest paid so far
   */
  static calculateTotalInterestPaid(
    originalAmount: number,
    currentBalance: number,
    totalPaid: number
  ): number {
    const principalPaid = originalAmount - currentBalance;
    return Math.max(0, totalPaid - principalPaid);
  }

  /**
   * Create a new loan
   */
  async create(data: Omit<LoanInsert, 'user_id'>): Promise<Loan> {
    const userId = await this.getUserId();

    // Validate amounts
    if (data.original_amount <= 0) {
      throw new ValidationError('Original loan amount must be greater than zero', 'original_amount');
    }

    if (data.current_balance < 0) {
      throw new ValidationError('Current balance cannot be negative', 'current_balance');
    }

    if (data.current_balance > data.original_amount) {
      throw new ValidationError('Current balance cannot exceed original amount', 'current_balance');
    }

    if (data.monthly_payment <= 0) {
      throw new ValidationError('Monthly payment must be greater than zero', 'monthly_payment');
    }

    // Calculate next payment date if not provided
    const nextPaymentDate = data.next_payment_date || 
      this.calculateNextPaymentDate(
        data.payment_frequency || 'Monthly',
        data.last_payment_date,
        data.start_date
      );

    const { data: loan, error } = await this.supabase
      .from('loans')
      .insert({
        ...data,
        user_id: userId,
        next_payment_date: nextPaymentDate,
        current_balance: data.current_balance || data.original_amount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create loan: ${error.message}`);
    }

    return loan;
  }

  /**
   * Get all loans for the current user
   */
  async getAll(status?: LoanStatusType, loanType?: LoanType): Promise<Loan[]> {
    await this.getUserId();

    let query = this.supabase
      .from('loans')
      .select('*')
      .order('start_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (loanType) {
      query = query.eq('loan_type', loanType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch loans: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get active loans only
   */
  async getActive(): Promise<Loan[]> {
    return this.getAll('Active');
  }

  /**
   * Get a single loan by ID
   */
  async getById(id: string): Promise<Loan> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Loan', id);
    }

    return data;
  }

  /**
   * Update a loan
   */
  async update(id: string, data: LoanUpdate): Promise<Loan> {
    await this.getUserId();

    // Validate amounts if provided
    if (data.original_amount !== undefined && data.original_amount <= 0) {
      throw new ValidationError('Original loan amount must be greater than zero', 'original_amount');
    }

    if (data.current_balance !== undefined && data.current_balance < 0) {
      throw new ValidationError('Current balance cannot be negative', 'current_balance');
    }

    if (data.monthly_payment !== undefined && data.monthly_payment <= 0) {
      throw new ValidationError('Monthly payment must be greater than zero', 'monthly_payment');
    }

    const { data: updated, error } = await this.supabase
      .from('loans')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update loan: ${error.message}`);
    }

    if (!updated) {
      throw new NotFoundError('Loan', id);
    }

    return updated;
  }

  /**
   * Delete a loan
   */
  async delete(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('loans')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete loan: ${error.message}`);
    }
  }

  /**
   * Mark loan as paid off
   */
  async markAsPaidOff(id: string): Promise<Loan> {
    return this.update(id, { 
      status: 'Paid Off',
      current_balance: 0,
    });
  }

  /**
   * Get loans due soon (within next 7 days)
   */
  async getDueSoon(): Promise<Loan[]> {
    await this.getUserId();

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('status', 'Active')
      .gte('next_payment_date', today.toISOString().split('T')[0])
      .lte('next_payment_date', nextWeek.toISOString().split('T')[0])
      .order('next_payment_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch loans due soon: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get total monthly payments for active loans
   */
  async getTotalMonthlyPayments(): Promise<number> {
    const activeLoans = await this.getActive();
    return activeLoans.reduce((total, loan) => {
      return total + LoanService.calculateMonthlyPayment(loan.monthly_payment, loan.payment_frequency);
    }, 0);
  }

  /**
   * Get total debt (sum of current balances)
   */
  async getTotalDebt(): Promise<number> {
    const activeLoans = await this.getActive();
    return activeLoans.reduce((total, loan) => total + loan.current_balance, 0);
  }

  /**
   * Record a loan payment
   */
  async recordPayment(data: Omit<LoanPaymentInsert, 'user_id'>): Promise<LoanPayment> {
    const userId = await this.getUserId();

    // Validate payment amounts
    if (data.payment_amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero', 'payment_amount');
    }

    if (data.principal_amount < 0 || data.interest_amount < 0) {
      throw new ValidationError('Principal and interest amounts cannot be negative', 'principal_amount');
    }

    if (Math.abs(data.payment_amount - (data.principal_amount + data.interest_amount)) > 0.01) {
      throw new ValidationError('Payment amount must equal principal + interest', 'payment_amount');
    }

    // Check loan exists and is active
    const loan = await this.getById(data.loan_id);
    if (loan.status !== 'Active') {
      throw new ValidationError('Cannot record payment for non-active loan', 'loan_id');
    }

    const { data: payment, error } = await this.supabase
      .from('loan_payments')
      .insert({
        ...data,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    // The trigger will automatically update the loan balance
    return payment;
  }

  /**
   * Get all payments for a loan
   */
  async getPayments(loanId: string): Promise<LoanPayment[]> {
    await this.getUserId();

    const { data, error } = await this.supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch loan payments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a loan payment
   */
  async updatePayment(id: string, data: LoanPaymentUpdate): Promise<LoanPayment> {
    await this.getUserId();

    // Validate amounts if provided
    if (data.payment_amount !== undefined && data.payment_amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero', 'payment_amount');
    }

    if (data.principal_amount !== undefined && data.principal_amount < 0) {
      throw new ValidationError('Principal amount cannot be negative', 'principal_amount');
    }

    if (data.interest_amount !== undefined && data.interest_amount < 0) {
      throw new ValidationError('Interest amount cannot be negative', 'interest_amount');
    }

    const { data: updated, error } = await this.supabase
      .from('loan_payments')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    if (!updated) {
      throw new NotFoundError('Loan Payment', id);
    }

    return updated;
  }

  /**
   * Delete a loan payment
   */
  async deletePayment(id: string): Promise<void> {
    await this.getUserId();

    const { error } = await this.supabase
      .from('loan_payments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete payment: ${error.message}`);
    }
  }
}
