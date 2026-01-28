'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Skeleton, SkeletonList, useToast } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MasterBudgetService } from '@/lib/services/master-budget.service';
import { BudgetService, BudgetHistoryEntry, BudgetTrend } from '@/lib/services/budget.service';
import type { MasterBudget, MasterBudgetHistoryEntry } from '@/lib/services/master-budget.service';

export default function MasterBudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [masterBudget, setMasterBudget] = useState<MasterBudget | null>(null);
  const [masterBudgetHistory, setMasterBudgetHistory] = useState<MasterBudgetHistoryEntry[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryEntry[]>([]);
  const [trends, setTrends] = useState<BudgetTrend[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [masterBudgetId, setMasterBudgetId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setMasterBudgetId(p.id));
  }, [params]);

  const loadMasterBudget = useCallback(async () => {
    if (!masterBudgetId) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const masterBudgetService = new MasterBudgetService(supabase);
      const data = await masterBudgetService.getById(masterBudgetId);
      setMasterBudget(data);
    } catch (err) {
      console.error('Failed to load master budget:', err);
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to load master budget',
        'error'
      );
      router.push('/master-budgets');
    } finally {
      setIsLoading(false);
    }
  }, [masterBudgetId, router, toast]);

  const loadHistory = useCallback(async () => {
    if (!masterBudgetId) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const masterBudgetService = new MasterBudgetService(supabase);
      const budgetService = new BudgetService(supabase);

      // Load master budget history
      const masterHistory = await masterBudgetService.getHistory({ 
        limit: 50, 
        masterBudgetId 
      });
      setMasterBudgetHistory(masterHistory);

      // Load individual budget history
      const budgetHistoryData = await budgetService.getHistoryByMasterBudget(masterBudgetId, { limit: 100 });
      setBudgetHistory(budgetHistoryData);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [masterBudgetId]);

  const loadTrends = useCallback(async () => {
    if (!masterBudgetId) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const budgetService = new BudgetService(supabase);
      const trendsData = await budgetService.getTrendsByMasterBudget(masterBudgetId, trendPeriod);
      setTrends(trendsData);
    } catch (err) {
      console.error('Failed to load trends:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trends';
      toast.showToast(errorMessage, 'error');
    } finally {
      setTrendsLoading(false);
    }
  }, [masterBudgetId, trendPeriod, toast]);

  useEffect(() => {
    loadMasterBudget();
  }, [loadMasterBudget]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setTrendsLoading(true);
    loadTrends();
  }, [loadTrends]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton variant="text" width="40%" height={40} />
        <Card variant="raised" padding="md">
          <Skeleton variant="text" width="30%" height={24} />
        </Card>
        <SkeletonList items={5} />
      </div>
    );
  }

  if (!masterBudget) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/master-budgets"
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-display text-[var(--color-text)]">{masterBudget.name}</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            €{Number(masterBudget.budget_amount).toLocaleString('en-IE', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
        </div>
      </div>

      {/* Master Budget Info */}
      <Card variant="raised" padding="lg">
        <div className="space-y-4">
          <div>
            <h2 className="text-headline text-[var(--color-text)] mb-2">Budget Details</h2>
            {masterBudget.description && (
              <p className="text-body text-[var(--color-text-muted)]">{masterBudget.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Status</p>
              <p className="text-body text-[var(--color-text)] mt-1">
                {masterBudget.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Created</p>
              <p className="text-body text-[var(--color-text)] mt-1">
                {new Date(masterBudget.created_at).toLocaleDateString('en-IE', {
                  dateStyle: 'medium',
                })}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Trends Section */}
      <Card variant="raised" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-headline text-[var(--color-text)]">Trends</h2>
          <div className="flex gap-2">
            <Button
              variant={trendPeriod === 'week' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTrendPeriod('week')}
            >
              Week
            </Button>
            <Button
              variant={trendPeriod === 'month' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTrendPeriod('month')}
            >
              Month
            </Button>
            <Button
              variant={trendPeriod === 'year' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTrendPeriod('year')}
            >
              Year
            </Button>
          </div>
        </div>

        {trendsLoading ? (
          <SkeletonList items={3} />
        ) : trends.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)] py-4">
            No trends data available yet. This budget category hasn't been used in any months.
          </p>
        ) : (
          <div className="space-y-4">
            <TrendsChart trends={trends} period={trendPeriod} />
            <div className="space-y-2">
              {trends.map((trend) => (
                <TrendRow key={trend.period} trend={trend} period={trendPeriod} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* History Section */}
      <Card variant="raised" padding="lg">
        <h2 className="text-headline text-[var(--color-text)] mb-4">History</h2>
        <p className="text-small text-[var(--color-text-muted)] mb-4">
          All changes to this master budget and its individual budget instances across months.
        </p>

        {historyLoading ? (
          <SkeletonList items={5} />
        ) : masterBudgetHistory.length === 0 && budgetHistory.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)] py-4">
            No changes recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Master Budget History */}
            {masterBudgetHistory.length > 0 && (
              <div>
                <h3 className="text-body font-medium text-[var(--color-text)] mb-2">
                  Master Budget Changes
                </h3>
                <ul className="space-y-2">
                  {masterBudgetHistory.map((entry) => (
                    <HistoryEntryRow key={entry.id} entry={entry} type="master" />
                  ))}
                </ul>
              </div>
            )}

            {/* Individual Budget History */}
            {budgetHistory.length > 0 && (
              <div>
                <h3 className="text-body font-medium text-[var(--color-text)] mb-2 mt-4">
                  Individual Budget Instances
                </h3>
                <ul className="space-y-2">
                  {budgetHistory.map((entry) => (
                    <BudgetHistoryEntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function TrendsChart({ trends, period }: { trends: BudgetTrend[]; period: 'week' | 'month' | 'year' }) {
  if (trends.length === 0) return null;

  const maxBudgeted = Math.max(...trends.map((t) => t.budgeted), 1);
  const maxSpent = Math.max(...trends.map((t) => t.spent), 1);
  const maxValue = Math.max(maxBudgeted, maxSpent);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-48">
        {trends.map((trend) => {
          const budgetedHeight = (trend.budgeted / maxValue) * 100;
          const spentHeight = (trend.spent / maxValue) * 100;
          
          return (
            <div key={trend.period} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end h-full gap-1">
                <div
                  className="w-full bg-[var(--color-primary)]/30 rounded-t"
                  style={{ height: `${budgetedHeight}%` }}
                  title={`Budgeted: €${trend.budgeted.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`}
                />
                <div
                  className="w-full bg-[var(--color-primary)] rounded-t"
                  style={{ height: `${spentHeight}%` }}
                  title={`Spent: €${trend.spent.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`}
                />
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
                {formatPeriodLabel(trend.period, period)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 justify-center text-small text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-primary)]/30 rounded" />
          <span>Budgeted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-primary)] rounded" />
          <span>Spent</span>
        </div>
      </div>
    </div>
  );
}

function TrendRow({ trend, period }: { trend: BudgetTrend; period: 'week' | 'month' | 'year' }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
      <div className="flex-1">
        <p className="text-body font-medium text-[var(--color-text)]">
          {formatPeriodLabel(trend.period, period)}
        </p>
        <div className="flex gap-4 mt-1 text-small text-[var(--color-text-muted)]">
          <span>Budgeted: €{trend.budgeted.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</span>
          <span>Spent: €{trend.spent.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</span>
          <span>Remaining: €{trend.remaining.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-body font-medium text-[var(--color-text)]">
          {trend.utilization.toFixed(1)}%
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">utilization</p>
      </div>
    </div>
  );
}

function HistoryEntryRow({ entry, type }: { entry: MasterBudgetHistoryEntry; type: 'master' }) {
  const name = entry.new_data?.name ?? entry.old_data?.name ?? 'Unknown';
  const detail = formatMasterHistoryDetail(entry);
  const when = new Date(entry.changed_at).toLocaleString('en-IE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const actionLabel = entry.action === 'created' ? 'Created' : entry.action === 'updated' ? 'Updated' : 'Deleted';
  const actionVariant = entry.action === 'created' ? 'success' : entry.action === 'updated' ? 'default' : 'danger';

  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex flex-wrap items-baseline gap-2 min-w-0">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-small font-medium ${
            actionVariant === 'success'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : actionVariant === 'danger'
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
          }`}
        >
          {actionLabel}
        </span>
        <span className="font-medium">{name}</span>
        {detail && <span className="text-[var(--color-text-muted)]">{detail}</span>}
      </div>
      <span className="text-small text-[var(--color-text-muted)] shrink-0">{when}</span>
    </div>
  );
}

function BudgetHistoryEntryRow({ entry }: { entry: BudgetHistoryEntry }) {
  const name = entry.new_data?.name ?? entry.old_data?.name ?? 'Unknown';
  const detail = formatBudgetHistoryDetail(entry);
  const when = new Date(entry.changed_at).toLocaleString('en-IE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const actionLabel = entry.action === 'created' ? 'Created' : entry.action === 'updated' ? 'Updated' : 'Deleted';
  const actionVariant = entry.action === 'created' ? 'success' : entry.action === 'updated' ? 'default' : 'danger';

  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex flex-wrap items-baseline gap-2 min-w-0">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-small font-medium ${
            actionVariant === 'success'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : actionVariant === 'danger'
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'
          }`}
        >
          {actionLabel}
        </span>
        <span className="font-medium">{name}</span>
        {detail && <span className="text-[var(--color-text-muted)]">{detail}</span>}
      </div>
      <span className="text-small text-[var(--color-text-muted)] shrink-0">{when}</span>
    </div>
  );
}

function formatMasterHistoryDetail(entry: MasterBudgetHistoryEntry): string {
  if (entry.action === 'created' && entry.new_data) {
    const amt = Number(entry.new_data.budget_amount);
    return `€${amt.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (entry.action === 'deleted' && entry.old_data) {
    const amt = Number(entry.old_data.budget_amount);
    return `was €${amt.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (entry.action === 'updated' && entry.old_data && entry.new_data) {
    const parts: string[] = [];
    if (entry.old_data.name !== entry.new_data.name) {
      parts.push(`name: "${entry.old_data.name}" → "${entry.new_data.name}"`);
    }
    if (Number(entry.old_data.budget_amount) !== Number(entry.new_data.budget_amount)) {
      const o = Number(entry.old_data.budget_amount);
      const n = Number(entry.new_data.budget_amount);
      parts.push(`amount: €${o.toLocaleString('en-IE', { minimumFractionDigits: 2 })} → €${n.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`);
    }
    if ((entry.old_data.description ?? '') !== (entry.new_data.description ?? '')) {
      parts.push('description changed');
    }
    return parts.length ? parts.join('; ') : 'details updated';
  }
  return '';
}

function formatBudgetHistoryDetail(entry: BudgetHistoryEntry): string {
  if (entry.action === 'created' && entry.new_data) {
    const amt = Number(entry.new_data.budget_amount || 0);
    return `€${amt.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (entry.action === 'deleted' && entry.old_data) {
    const amt = Number(entry.old_data.budget_amount || 0);
    return `was €${amt.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (entry.action === 'updated' && entry.old_data && entry.new_data) {
    const parts: string[] = [];
    if (entry.old_data.name !== entry.new_data.name) {
      parts.push(`name: "${entry.old_data.name}" → "${entry.new_data.name}"`);
    }
    if (Number(entry.old_data.budget_amount || 0) !== Number(entry.new_data.budget_amount || 0)) {
      const o = Number(entry.old_data.budget_amount || 0);
      const n = Number(entry.new_data.budget_amount || 0);
      parts.push(`amount: €${o.toLocaleString('en-IE', { minimumFractionDigits: 2 })} → €${n.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`);
    }
    return parts.length ? parts.join('; ') : 'details updated';
  }
  return '';
}

function formatPeriodLabel(period: string, type: 'week' | 'month' | 'year'): string {
  if (type === 'week') {
    // Format: "2026-W03" -> "Week 3, 2026"
    const match = period.match(/^(\d{4})-W(\d{2})$/);
    if (match) {
      return `Week ${parseInt(match[2])}, ${match[1]}`;
    }
    return period;
  } else if (type === 'month') {
    // Format: "2026-01" -> "January 2026"
    const match = period.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2]);
      const monthName = new Date(parseInt(year), month - 1).toLocaleDateString('en-IE', { month: 'long' });
      return `${monthName} ${year}`;
    }
    return period;
  } else {
    // Format: "2026" -> "2026"
    return period;
  }
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}
