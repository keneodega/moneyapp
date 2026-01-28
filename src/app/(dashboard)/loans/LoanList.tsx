'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loan, LoanStatusType, LoanType } from '@/lib/supabase/database.types';
import { LoanService } from '@/lib/services';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';

interface LoanListProps {
  loans: Loan[];
}

const statusColors: Record<LoanStatusType, string> = {
  Active: 'bg-green-500/10 text-green-400',
  'Paid Off': 'bg-blue-500/10 text-blue-400',
  Defaulted: 'bg-red-500/10 text-red-400',
  Refinanced: 'bg-purple-500/10 text-purple-400',
  Closed: 'bg-gray-500/10 text-gray-400',
};

const typeIcons: Record<LoanType, string> = {
  Mortgage: '🏠',
  'Car Loan': '🚗',
  'Personal Loan': '💳',
  'Student Loan': '🎓',
  'Credit Card': '💳',
  Other: '📋',
};

export function LoanList({ loans }: LoanListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | LoanStatusType>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LoanType>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const filteredLoans = loans.filter(loan => {
    // Status filter
    if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
    // Type filter
    if (typeFilter !== 'all' && loan.loan_type !== typeFilter) return false;
    return true;
  });

  const handleMarkPaidOff = async (id: string) => {
    if (!confirm('Mark this loan as paid off? This will set the balance to zero.')) return;
    
    setLoading(id);
    try {
      const service = new LoanService(supabase);
      await service.markAsPaidOff(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to mark loan as paid off:', error);
      alert('Failed to update loan. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loan? This will also delete all payment history.')) return;
    
    setLoading(id);
    try {
      const service = new LoanService(supabase);
      await service.delete(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete loan:', error);
      alert('Failed to delete loan. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IE', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    });
  };

  const calculateProgress = (loan: Loan) => {
    if (loan.original_amount === 0) return 0;
    const paid = loan.original_amount - loan.current_balance;
    return (paid / loan.original_amount) * 100;
  };

  const calculateMonthsRemaining = (loan: Loan) => {
    if (loan.status !== 'Active' || loan.current_balance <= 0) return 0;
    return LoanService.calculateMonthsRemaining(
      loan.current_balance,
      LoanService.calculateMonthlyPayment(loan.monthly_payment, loan.payment_frequency),
      loan.interest_rate
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="space-y-3">
        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'Active', 'Paid Off', 'Closed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {status === 'all' ? 'All' : status}
              <span className="ml-1 opacity-60">
                ({status === 'all' ? loans.length : loans.filter(l => l.status === status).length})
              </span>
            </button>
          ))}
        </div>
        
        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'Mortgage', 'Car Loan', 'Personal Loan', 'Student Loan', 'Credit Card'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {type === 'all' ? 'All Types' : type}
              <span className="ml-1 opacity-60">
                ({type === 'all' 
                  ? loans.length 
                  : loans.filter(l => l.loan_type === type).length
                })
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLoans.map((loan) => {
          const progress = calculateProgress(loan);
          const monthsRemaining = calculateMonthsRemaining(loan);
          const monthlyPayment = LoanService.calculateMonthlyPayment(loan.monthly_payment, loan.payment_frequency);

          return (
            <Card key={loan.id} variant="outlined" padding="md" className="relative group">
              {loading === loan.id && (
                <div className="absolute inset-0 bg-[var(--color-surface)]/80 flex items-center justify-center rounded-[var(--radius-lg)] z-10">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center text-xl">
                    {typeIcons[loan.loan_type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-title text-[var(--color-text)]">{loan.name}</h3>
                    </div>
                    <p className="text-small text-[var(--color-text-muted)]">
                      {loan.loan_type}
                      {loan.person && ` · ${loan.person}`}
                      {loan.lender_name && ` · ${loan.lender_name}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-small ${statusColors[loan.status]}`}>
                  {loan.status}
                </span>
              </div>

              {/* Progress Bar */}
              {loan.status === 'Active' && (
                <div className="mb-4">
                  <div className="flex justify-between text-small text-[var(--color-text-muted)] mb-1">
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-success)] transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Original Amount</p>
                  <p className="text-body font-medium text-[var(--color-text)]">
                    <Currency amount={loan.original_amount} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Current Balance</p>
                  <p className="text-body font-medium text-[var(--color-danger)]">
                    <Currency amount={loan.current_balance} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Monthly Payment</p>
                  <p className="text-body font-medium text-[var(--color-text)]">
                    <Currency amount={monthlyPayment} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Interest Rate</p>
                  <p className="text-body text-[var(--color-text)]">
                    {loan.interest_rate.toFixed(2)}% APR
                  </p>
                </div>
                {loan.status === 'Active' && monthsRemaining > 0 && (
                  <div className="col-span-2">
                    <p className="text-small text-[var(--color-text-muted)]">Estimated Time Remaining</p>
                    <p className="text-body text-[var(--color-text)]">
                      {monthsRemaining} {monthsRemaining === 1 ? 'month' : 'months'}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Next Payment</p>
                  <p className="text-body text-[var(--color-text)]">
                    {formatDate(loan.next_payment_date)}
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Payment Method</p>
                  <p className="text-body text-[var(--color-text)]">
                    {loan.payment_method || loan.bank || '-'}
                  </p>
                </div>
              </div>

              {loan.description && (
                <p className="mb-4 text-small text-[var(--color-text-muted)] line-clamp-2">
                  {loan.description}
                </p>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-[var(--color-border)] flex items-center gap-2">
                <Link
                  href={`/loans/${loan.id}/edit`}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Edit
                </Link>
                
                <Link
                  href={`/loans/${loan.id}/payments`}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  Payments
                </Link>
                
                {loan.status === 'Active' && (
                  <button
                    onClick={() => handleMarkPaidOff(loan.id)}
                    className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    Mark Paid Off
                  </button>
                )}
                
                <button
                  onClick={() => handleDelete(loan.id)}
                  className="ml-auto px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredLoans.length === 0 && (
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">
            No {statusFilter === 'all' ? '' : statusFilter.toLowerCase()} loans found.
          </p>
        </Card>
      )}
    </div>
  );
}
