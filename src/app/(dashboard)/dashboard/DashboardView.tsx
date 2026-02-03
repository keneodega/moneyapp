'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, PageHeader } from '@/components/ui';

// Code splitting: Load dashboard components dynamically
const SubscriptionsDashboard = dynamic(() => import('./SubscriptionsDashboard').then(mod => ({ default: mod.SubscriptionsDashboard })), {
  loading: () => <div className="p-4 text-small text-[var(--color-text-muted)]">Loading subscriptions...</div>,
});

const BudgetDashboard = dynamic(() => import('./BudgetDashboard').then(mod => ({ default: mod.BudgetDashboard })), {
  loading: () => <div className="p-4 text-small text-[var(--color-text-muted)]">Loading budget data...</div>,
});

const TransactionsDashboard = dynamic(() => import('./TransactionsDashboard').then(mod => ({ default: mod.TransactionsDashboard })), {
  loading: () => <div className="p-4 text-small text-[var(--color-text-muted)]">Loading transactions...</div>,
});

const DateRangeFilter = dynamic(() => import('./DateRangeFilter').then(mod => ({ default: mod.DateRangeFilter })), {
  loading: () => <div className="h-10 w-48 bg-[var(--color-surface-sunken)] rounded-[var(--radius-md)] animate-pulse" />,
});

const AIInsightsWidget = dynamic(() => import('./AIInsightsWidget').then(mod => ({ default: mod.AIInsightsWidget })), {
  loading: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 animate-pulse" />
        <div className="h-4 w-24 bg-[var(--color-surface-sunken)] rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] animate-pulse">
          <div className="h-4 w-3/4 bg-[var(--color-border)] rounded mb-2" />
          <div className="h-3 w-full bg-[var(--color-border)] rounded" />
        </div>
      ))}
    </div>
  ),
});

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  });

  useEffect(() => {
    // Update date range when period changes
    if (period === 'custom') {
      // Keep existing date range for custom
      return;
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = new Date(now);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // End of day
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    console.log(`Setting date range for ${period}:`, {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });

    setDateRange({ start, end });
  }, [period]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Controls */}
      <PageHeader
        title="Financial Dashboard"
        subtitle="Comprehensive view of your financial data"
        actions={
          <DateRangeFilter
            period={period}
            dateRange={dateRange}
            onPeriodChange={setPeriod}
            onDateRangeChange={setDateRange}
          />
        }
      />

      {/* Dashboard Sections */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6 order-2 lg:order-1">
          {/* Subscriptions Dashboard */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-title text-[var(--color-text)]">Subscriptions Overview</h2>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Recurring costs and upcoming commitments
                </p>
              </div>
            </div>
            <SubscriptionsDashboard dateRange={dateRange} />
          </Card>

          {/* Budget Dashboard */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-title text-[var(--color-text)]">Budget & Expenditure</h2>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Allocation vs. actual spend across periods
                </p>
              </div>
            </div>
            <BudgetDashboard dateRange={dateRange} />
          </Card>

          {/* Transactions Dashboard */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-title text-[var(--color-text)]">All Transactions</h2>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Income and expenses within the selected range
                </p>
              </div>
            </div>
            <TransactionsDashboard dateRange={dateRange} />
          </Card>
        </div>

        {/* AI Insights Sidebar */}
        <div className="order-1 lg:order-2">
          <Card variant="raised" padding="lg" className="lg:sticky lg:top-4">
            <AIInsightsWidget />
          </Card>
        </div>
      </div>
    </div>
  );
}
