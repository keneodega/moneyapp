'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SubscriptionService } from '@/lib/services';
import { SubscriptionsDashboard } from './SubscriptionsDashboard';
import { BudgetDashboard } from './BudgetDashboard';
import { TransactionsDashboard } from './TransactionsDashboard';
import { DateRangeFilter } from './DateRangeFilter';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Update date range when period changes
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (period) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        // Keep existing date range
        return;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setDateRange({ start, end });
  }, [period]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-[var(--color-text)]">Financial Dashboard</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            Comprehensive view of your financial data
          </p>
        </div>
        <DateRangeFilter
          period={period}
          dateRange={dateRange}
          onPeriodChange={setPeriod}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Dashboard Sections */}
      <div className="grid gap-6">
        {/* Subscriptions Dashboard */}
        <Card variant="outlined" padding="lg">
          <h2 className="text-title text-[var(--color-text)] mb-4">Subscriptions Overview</h2>
          <SubscriptionsDashboard dateRange={dateRange} />
        </Card>

        {/* Budget Dashboard */}
        <Card variant="outlined" padding="lg">
          <h2 className="text-title text-[var(--color-text)] mb-4">Budget & Expenditure</h2>
          <BudgetDashboard dateRange={dateRange} />
        </Card>

        {/* Transactions Dashboard */}
        <Card variant="outlined" padding="lg">
          <h2 className="text-title text-[var(--color-text)] mb-4">All Transactions</h2>
          <TransactionsDashboard dateRange={dateRange} />
        </Card>
      </div>
    </div>
  );
}
