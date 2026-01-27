'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SubscriptionService } from '@/lib/services';
import { Card, SkeletonCard } from '@/components/ui';
import type { Subscription } from '@/lib/supabase/database.types';

interface DateRange {
  start: Date;
  end: Date;
}

interface SubscriptionsDashboardProps {
  dateRange: DateRange;
}

interface MonthlySubscriptionData {
  month: string;
  subscriptions: Array<{
    subscription: Subscription;
    monthlyCost: number;
  }>;
  total: number;
}

export function SubscriptionsDashboard({ dateRange }: SubscriptionsDashboardProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySubscriptionData[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [totalYearly, setTotalYearly] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const service = new SubscriptionService(supabase);
      const allSubscriptions = await service.getActive();

      // Filter subscriptions that are active during the date range
      const filtered = allSubscriptions.filter((sub) => {
        if (!sub.start_date) return true;
        const startDate = new Date(sub.start_date);
        const endDate = sub.end_date ? new Date(sub.end_date) : null;
        return (
          startDate <= dateRange.end &&
          (!endDate || endDate >= dateRange.start)
        );
      });

      setSubscriptions(filtered);

      // Calculate monthly breakdown
      const months = getMonthsInRange(dateRange.start, dateRange.end);
      const monthlyBreakdown: MonthlySubscriptionData[] = months.map((month) => {
        const monthSubs = filtered
          .filter((sub) => isSubscriptionActiveInMonth(sub, month))
          .map((sub) => ({
            subscription: sub,
            monthlyCost: SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency),
          }));

        return {
          month: month.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' }),
          subscriptions: monthSubs,
          total: monthSubs.reduce((sum, s) => sum + s.monthlyCost, 0),
        };
      });

      setMonthlyData(monthlyBreakdown);

      // Calculate totals
      const monthlyTotal = filtered.reduce((sum, sub) => {
        return sum + SubscriptionService.calculateMonthlyCost(sub.amount, sub.frequency);
      }, 0);
      const yearlyTotal = filtered.reduce((sum, sub) => {
        return sum + SubscriptionService.calculateYearlyCost(sub.amount, sub.frequency);
      }, 0);

      setTotalMonthly(monthlyTotal);
      setTotalYearly(yearlyTotal);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  function getMonthsInRange(start: Date, end: Date): Date[] {
    const months: Date[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endMonth) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  function isSubscriptionActiveInMonth(sub: Subscription, month: Date): boolean {
    if (!sub.start_date) return true;
    const startDate = new Date(sub.start_date);
    const endDate = sub.end_date ? new Date(sub.end_date) : null;

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    return (
      startDate <= monthEnd &&
      (!endDate || endDate >= monthStart) &&
      sub.status === 'Active'
    );
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Monthly Cost</p>
          <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
            {formatCurrency(totalMonthly)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Yearly Cost</p>
          <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
            {formatCurrency(totalYearly)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Active Subscriptions</p>
          <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
            {subscriptions.length}
          </p>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <div className="space-y-4">
        <h3 className="text-body font-medium text-[var(--color-text)]">Monthly Breakdown</h3>
        {monthlyData.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)]">No subscriptions in this period</p>
        ) : (
          <div className="space-y-3">
            {monthlyData.map((monthData, idx) => (
              <Card key={idx} variant="outlined" padding="md">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-body font-medium text-[var(--color-text)]">
                    {monthData.month}
                  </h4>
                  <p className="text-body font-medium text-[var(--color-primary)] tabular-nums">
                    {formatCurrency(monthData.total)}
                  </p>
                </div>
                <div className="space-y-2">
                  {monthData.subscriptions.map(({ subscription, monthlyCost }) => (
                    <div
                      key={subscription.id}
                      className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
                    >
                      <div className="flex-1">
                        <p className="text-small font-medium text-[var(--color-text)]">
                          {subscription.name}
                        </p>
                        <p className="text-caption text-[var(--color-text-muted)]">
                          {subscription.frequency} • {formatCurrency(subscription.amount)}
                        </p>
                      </div>
                      <p className="text-small font-medium text-[var(--color-text)] tabular-nums ml-4">
                        {formatCurrency(monthlyCost)}/mo
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
