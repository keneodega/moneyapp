import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DebtorService } from '@/lib/services';
import { Card, DashboardTile, PageHeader } from '@/components/ui';
import Link from 'next/link';
import { DebtorList } from './DebtorList';

export default async function DebtorsPage() {
  const supabase = await createSupabaseServerClient();
  const service = new DebtorService(supabase);

  let debtors: Awaited<ReturnType<typeof service.getAll>> = [];
  try {
    debtors = await service.getAll();
  } catch {
    // Table may not exist yet - show empty state
  }
  const activeDebtors = debtors.filter(d => d.status === 'Active' || d.status === 'Partially Paid');

  // Calculate totals
  const totalOwed = activeDebtors.reduce(
    (total, d) => total + (Number(d.amount_owed) - Number(d.amount_repaid)), 0
  );
  const totalLentOut = debtors.reduce((total, d) => total + Number(d.amount_owed), 0);
  const totalRecovered = debtors.reduce((total, d) => total + Number(d.amount_repaid), 0);

  // Check for overdue
  const today = new Date().toISOString().split('T')[0];
  const overdueDebtors = activeDebtors.filter(d =>
    d.expected_repayment_date && d.expected_repayment_date < today
  );

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
        title="Debtors"
        subtitle="Track money owed to you"
        actions={
          <Link
            href="/debtors/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Debtor
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardTile
          title="Active Debtors"
          value={String(activeDebtors.length)}
          helper="Currently outstanding"
          tone="default"
        />
        <DashboardTile
          title="Total Owed to You"
          value={formatCurrency(totalOwed)}
          helper="Outstanding balance"
          tone="primary"
        />
        <DashboardTile
          title="Total Recovered"
          value={formatCurrency(totalRecovered)}
          helper={
            totalLentOut > 0
              ? `${((totalRecovered / totalLentOut) * 100).toFixed(1)}% of total lent`
              : 'No debts yet'
          }
          tone="success"
        />
        <DashboardTile
          title="Overdue"
          value={String(overdueDebtors.length)}
          helper="Past expected date"
          tone={overdueDebtors.length > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Overdue Alert */}
      {overdueDebtors.length > 0 && (
        <Card variant="outlined" padding="md" className="border-[var(--color-danger)]/50 bg-[var(--color-danger)]/5">
          <div className="flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-[var(--color-danger)] mt-0.5" />
            <div>
              <h3 className="text-title text-[var(--color-text)] mb-1">Overdue Repayments</h3>
              <p className="text-small text-[var(--color-text-muted)]">
                {overdueDebtors.length} debtor{overdueDebtors.length > 1 ? 's' : ''} past their expected repayment date
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overdueDebtors.map(d => (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-small"
                  >
                    {d.debtor_name} - {formatCurrency(Number(d.amount_owed) - Number(d.amount_repaid))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Debtor List */}
      {debtors.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <DebtorsIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No Debtors Yet</h3>
          <p className="text-body text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
            Start tracking people who owe you money and follow up on repayments.
          </p>
          <Link
            href="/debtors/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Track Your First Debtor
          </Link>
        </Card>
      ) : (
        <DebtorList debtors={debtors} />
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

function DebtorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
