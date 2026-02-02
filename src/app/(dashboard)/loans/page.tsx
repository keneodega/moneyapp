import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoanService } from '@/lib/services';
import { Card, DashboardTile, PageHeader } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import Link from 'next/link';
import { LoanList } from './LoanList';

export default async function LoansPage() {
  const supabase = await createSupabaseServerClient();
  const service = new LoanService(supabase);

  const loans = await service.getAll();
  const activeLoans = loans.filter(l => l.status === 'Active');
  
  // Calculate totals
  const totalDebt = activeLoans.reduce((total, loan) => total + loan.current_balance, 0);
  const totalMonthlyPayments = activeLoans.reduce((total, loan) => {
    return total + LoanService.calculateMonthlyPayment(loan.monthly_payment, loan.payment_frequency);
  }, 0);
  
  const totalOriginalAmount = loans.reduce((total, loan) => total + loan.original_amount, 0);
  const totalPaidOff = totalOriginalAmount - totalDebt;

  // Get loans due soon (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const dueSoon = activeLoans.filter(loan => {
    if (!loan.next_payment_date) return false;
    const nextDate = new Date(loan.next_payment_date);
    return nextDate >= today && nextDate <= nextWeek;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Loans"
        subtitle="Track your loans, debts, and payment schedules"
        actions={
          <Link
            href="/loans/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Loan
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardTile
          title="Active Loans"
          value={String(activeLoans.length)}
          helper="Currently active"
          tone="default"
        />
        <DashboardTile
          title="Total Debt"
          value={formatCurrency(totalDebt)}
          helper="Outstanding balance"
          tone="danger"
        />
        <DashboardTile
          title="Monthly Payments"
          value={formatCurrency(totalMonthlyPayments)}
          helper="Across active loans"
          tone="primary"
        />
        <DashboardTile
          title="Due This Week"
          value={String(dueSoon.length)}
          helper="Upcoming payments"
          tone="warning"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardTile
          title="Total Paid Off"
          value={formatCurrency(totalPaidOff)}
          helper={
            totalOriginalAmount > 0
              ? `${((totalPaidOff / totalOriginalAmount) * 100).toFixed(1)}% of total loans`
              : 'No loans yet'
          }
          tone="success"
        />
        <DashboardTile
          title="Remaining Balance"
          value={formatCurrency(totalDebt)}
          helper={
            totalOriginalAmount > 0
              ? `${((totalDebt / totalOriginalAmount) * 100).toFixed(1)}% remaining`
              : 'No loans yet'
          }
          tone="default"
        />
      </div>

      {/* Due Soon Alert */}
      {dueSoon.length > 0 && (
        <Card variant="outlined" padding="md" className="border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5">
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-[var(--color-warning)] mt-0.5" />
            <div>
              <h3 className="text-title text-[var(--color-text)] mb-1">Upcoming Payments</h3>
              <p className="text-small text-[var(--color-text-muted)]">
                {dueSoon.length} loan{dueSoon.length > 1 ? 's' : ''} due in the next 7 days
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dueSoon.map(loan => (
                  <span 
                    key={loan.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] text-small"
                  >
                    {loan.name} - <Currency amount={loan.monthly_payment} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Loan List */}
      {loans.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <BankIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No Loans Yet</h3>
          <p className="text-body text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
            Start tracking your loans including mortgages, car loans, personal loans, and credit card debt.
          </p>
          <Link
            href="/loans/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Your First Loan
          </Link>
        </Card>
      ) : (
        <LoanList loans={loans} />
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75m0 0h.375c.621 0 1.125-.504 1.125-1.125M4.5 15h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H4.5v-.75z" />
    </svg>
  );
}
