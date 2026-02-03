import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SubscriptionService } from '@/lib/services';
import { Card, DashboardTile, PageHeader } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import Link from 'next/link';
import { SubscriptionList } from './SubscriptionList';

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();
  const service = new SubscriptionService(supabase);

  const subscriptions = await service.getAll();
  const activeSubscriptions = subscriptions.filter(s => s.status === 'Active');
  
  // Calculate totals
  const totalMonthly = activeSubscriptions.reduce((total, sub) => {
    return total + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
  }, 0);
  
  const totalYearly = activeSubscriptions.reduce((total, sub) => {
    return total + SubscriptionService.calculateYearlyCost(sub.amount, sub.frequency);
  }, 0);

  // Get subscriptions due soon (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const dueSoon = activeSubscriptions.filter(sub => {
    if (!sub.next_collection_date) return false;
    const nextDate = new Date(sub.next_collection_date);
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
        title="Subscriptions"
        subtitle="Track your recurring payments and subscriptions"
        actions={
          <Link
            href="/subscriptions/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Subscription
          </Link>
        }
      />

      {/* Stats Summary */}
      <div className="grid gap-4 lg:grid-cols-4">
        <DashboardTile
          title="Monthly Cost"
          value={formatCurrency(totalMonthly)}
          helper="Active subscriptions only"
          tone="primary"
        />
        <DashboardTile
          title="Yearly Cost"
          value={formatCurrency(totalYearly)}
          helper="Projected annual spend"
          tone="default"
        />
        <DashboardTile
          title="Active"
          value={String(activeSubscriptions.length)}
          helper="Subscriptions running"
          tone="default"
        />
        <DashboardTile
          title="Due This Week"
          value={String(dueSoon.length)}
          helper="Upcoming payments"
          tone="warning"
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
                {dueSoon.length} subscription{dueSoon.length > 1 ? 's' : ''} due in the next 7 days
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dueSoon.map(sub => (
                  <Link
                    key={sub.id}
                    href={`/subscriptions/${sub.id}/edit`}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] text-small hover:bg-[var(--color-warning)]/20 transition-colors"
                  >
                    <span className="font-medium">{sub.name}</span>
                    <span className="opacity-70">•</span>
                    <Currency amount={sub.amount} />
                    {sub.bank && (
                      <>
                        <span className="opacity-70">•</span>
                        <span className="text-[var(--color-text-muted)]">{sub.bank}</span>
                      </>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Subscription List */}
      {subscriptions.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <RepeatIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No Subscriptions Yet</h3>
          <p className="text-body text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
            Start tracking your recurring payments like Netflix, Spotify, gym memberships, and more.
          </p>
          <Link
            href="/subscriptions/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Your First Subscription
          </Link>
        </Card>
      ) : (
        <SubscriptionList subscriptions={subscriptions} />
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

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
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
