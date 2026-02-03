'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, DashboardTile, Input, PageHeader, Select, Skeleton, SkeletonList, useToast, useConfirmDialog, PieChart, type PieChartData } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MasterBudgetService, SubscriptionService } from '@/lib/services';
import type { MasterBudget, MasterBudgetHistoryEntry, BudgetType } from '@/lib/services/master-budget.service';

export default function MasterBudgetsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirmDialog = useConfirmDialog();
  const [budgets, setBudgets] = useState<MasterBudget[]>([]);
  const [breakdown, setBreakdown] = useState<{
    fixed: { total: number; budgets: MasterBudget[] };
    variable: { total: number; budgets: MasterBudget[] };
    grandTotal: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    budget_amount: '',
    description: '',
    budget_type: 'Fixed' as BudgetType,
  });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<MasterBudgetHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [subscriptionSummary, setSubscriptionSummary] = useState<{
    activeCount: number;
    totalMonthly: number;
    totalYearly: number;
  } | null>(null);

  const loadBudgets = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const masterBudgetService = new MasterBudgetService(supabase);
      const data = await masterBudgetService.getAll(true);
      setBudgets(data);
      
      // Load breakdown for pie charts
      const breakdownData = await masterBudgetService.getBudgetBreakdown(true);
      setBreakdown(breakdownData);
    } catch (err) {
      console.error('Failed to load master budgets:', err);
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to load master budgets',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadHistory = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const masterBudgetService = new MasterBudgetService(supabase);
      const data = await masterBudgetService.getHistory({ limit: 50 });
      setHistory(data);
    } catch (err) {
      console.error('Failed to load master budget history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const subscriptionService = new SubscriptionService(supabase);
      const allSubscriptions = await subscriptionService.getAll();
      const activeSubscriptions = allSubscriptions.filter(s => s.status === 'Active');
      const totalMonthly = activeSubscriptions.reduce(
        (sum, s) => sum + SubscriptionService.calculateMonthlyCost(s.amount, s.frequency),
        0
      );
      const totalYearly = activeSubscriptions.reduce(
        (sum, s) => sum + SubscriptionService.calculateYearlyCost(s.amount, s.frequency),
        0
      );
      setSubscriptionSummary({
        activeCount: activeSubscriptions.length,
        totalMonthly,
        totalYearly,
      });
    } catch (err) {
      console.error('Failed to load subscription summary:', err);
    }
  }, []);

  useEffect(() => {
    loadBudgets();
    loadSubscriptions();
  }, [loadBudgets]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const masterBudgetService = new MasterBudgetService(supabase);

      await masterBudgetService.create({
        name: formData.name.trim(),
        budget_amount: parseFloat(formData.budget_amount) || 0,
        description: formData.description.trim() || null,
        budget_type: formData.budget_type,
      });

      setFormData({ name: '', budget_amount: '', description: '', budget_type: 'Fixed' });
      setShowAddForm(false);
      await loadBudgets();
      await loadHistory();
      toast.showToast('Master budget created successfully', 'success');
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to create master budget',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string, updates: { name?: string; budget_amount?: number; description?: string | null; budget_type?: BudgetType }) => {
    setSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const masterBudgetService = new MasterBudgetService(supabase);

      await masterBudgetService.update(id, updates);
      await loadBudgets();
      await loadHistory();
      toast.showToast('Master budget updated successfully', 'success');
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : 'Failed to update master budget',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    confirmDialog.showConfirm({
      title: 'Delete Master Budget',
      message: 'Are you sure you want to delete this master budget? This will not affect existing monthly budgets, but new months will not include this category.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setSaving(true);
        try {
          const supabase = createSupabaseBrowserClient();
          const masterBudgetService = new MasterBudgetService(supabase);

          await masterBudgetService.delete(id, true);
          await loadBudgets();
          await loadHistory();
          toast.showToast('Master budget deleted successfully', 'success');
        } catch (err) {
          toast.showToast(
            err instanceof Error ? err.message : 'Failed to delete master budget',
            'error'
          );
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const totalAmount = breakdown?.grandTotal ?? budgets.reduce((sum, b) => sum + Number(b.budget_amount || 0), 0);
  
  // Prepare pie chart data
  const combinedChartData: PieChartData[] = [
    { name: 'Fixed Budgets', value: breakdown?.fixed.total ?? 0 },
    { name: 'Variable Budgets', value: breakdown?.variable.total ?? 0 },
  ];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <Skeleton variant="text" width="40%" height={40} className="mb-2" />
          <Skeleton variant="text" width="60%" height={20} />
        </div>
        <Card variant="raised" padding="md">
          <Skeleton variant="text" width="30%" height={24} />
        </Card>
        <SkeletonList items={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Master Budgets"
        subtitle="Manage your baseline budget categories. These amounts are copied to each new month."
        actions={
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="primary"
          >
            <PlusIcon className="w-5 h-5" />
            Add Budget Category
          </Button>
        }
      />

      {/* Total Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardTile
          title="Total Master Budget"
          value={formatCurrency(totalAmount)}
          helper={
            breakdown
              ? `Fixed: ${formatCurrency(breakdown.fixed.total)} • Variable: ${formatCurrency(breakdown.variable.total)}`
              : 'Total across all categories'
          }
          tone="primary"
        />
        {breakdown && (
          <>
            <DashboardTile
              title="Fixed Budgets"
              value={formatCurrency(breakdown.fixed.total)}
              helper={`${breakdown.fixed.budgets.length} ${breakdown.fixed.budgets.length === 1 ? 'budget' : 'budgets'}`}
              tone="default"
            />
            <DashboardTile
              title="Variable Budgets"
              value={formatCurrency(breakdown.variable.total)}
              helper={`${breakdown.variable.budgets.length} ${breakdown.variable.budgets.length === 1 ? 'budget' : 'budgets'}`}
              tone="default"
            />
          </>
        )}
      </div>

      {/* Subscription Summary */}
      {subscriptionSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardTile
            title="Active Subscriptions"
            value={String(subscriptionSummary.activeCount)}
            helper="Recurring payments"
            tone="default"
          />
          <DashboardTile
            title="Monthly Subscriptions"
            value={formatCurrency(subscriptionSummary.totalMonthly)}
            helper="Monthly run rate"
            tone="primary"
          />
          <DashboardTile
            title="Yearly Subscriptions"
            value={formatCurrency(subscriptionSummary.totalYearly)}
            helper="Projected annual cost"
            tone="default"
          />
        </div>
      )}

      {/* Budget Type Navigation Cards */}
      {breakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/master-budgets/fixed">
            <Card variant="raised" padding="lg" className="hover:shadow-[var(--shadow-lg)] transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-headline text-[var(--color-text)]">Fixed Budgets</h3>
                <BudgetTypeBadge type="Fixed" />
              </div>
              <div className="text-center">
                <p className="text-display text-[var(--color-text)]">
                  €{breakdown.fixed.total.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-small text-[var(--color-text-muted)] mt-2">
                  {breakdown.fixed.budgets.length} {breakdown.fixed.budgets.length === 1 ? 'budget' : 'budgets'}
                </p>
                <p className="text-small text-[var(--color-text-muted)] mt-4 flex items-center justify-center gap-1">
                  View details <ChevronRightIcon className="w-4 h-4" />
                </p>
              </div>
            </Card>
          </Link>
          <Link href="/master-budgets/variable">
            <Card variant="raised" padding="lg" className="hover:shadow-[var(--shadow-lg)] transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-headline text-[var(--color-text)]">Variable Budgets</h3>
                <BudgetTypeBadge type="Variable" />
              </div>
              <div className="text-center">
                <p className="text-display text-[var(--color-text)]">
                  €{breakdown.variable.total.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-small text-[var(--color-text-muted)] mt-2">
                  {breakdown.variable.budgets.length} {breakdown.variable.budgets.length === 1 ? 'budget' : 'budgets'}
                </p>
                <p className="text-small text-[var(--color-text-muted)] mt-4 flex items-center justify-center gap-1">
                  View details <ChevronRightIcon className="w-4 h-4" />
                </p>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Combined Pie Chart */}
      {breakdown && breakdown.grandTotal > 0 && (
        <Card variant="raised" padding="lg">
          <h3 className="text-headline text-[var(--color-text)] mb-4">Combined Budget Breakdown</h3>
          <PieChart
            data={combinedChartData}
            showLegend={true}
            showLabels={false}
            innerRadius={80}
            outerRadius={150}
            height={400}
          />
          <p className="text-center text-body font-medium text-[var(--color-text)] mt-4">
            Total: €{breakdown.grandTotal.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      )}

      {/* Add Form */}
      {showAddForm && (
        <Card variant="raised" padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Category Name"
                name="name"
                placeholder="e.g., Food, Housing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Budget Amount (€)"
                name="budget_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.budget_amount}
                onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Budget Type"
                name="budget_type"
                value={formData.budget_type}
                onChange={(e) => setFormData({ ...formData, budget_type: e.target.value as BudgetType })}
                required
                options={[
                  { value: 'Fixed', label: 'Fixed (rarely changes)' },
                  { value: 'Variable', label: 'Variable (changes month-to-month)' },
                ]}
              />
              <Input
                label="Description (Optional)"
                name="description"
                placeholder="Brief description of this budget category"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', budget_amount: '', description: '', budget_type: 'Fixed' });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={saving}>
                Add Budget
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* History */}
      <Card variant="raised" padding="lg">
        <h2 className="text-headline text-[var(--color-text)] mb-4">History</h2>
        <p className="text-small text-[var(--color-text-muted)] mb-4">
          Recent changes to master budgets: when categories were added, updated, or removed.
        </p>
        {historyLoading ? (
          <SkeletonList items={3} />
        ) : history.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)] py-4">
            No changes recorded yet. Add, edit, or delete a budget to see history here.
          </p>
        ) : (
          <ul className="space-y-3" role="list">
            {history.map((entry) => (
              <HistoryEntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HistoryEntryRow({ entry }: { entry: MasterBudgetHistoryEntry }) {
  const name = entry.new_data?.name ?? entry.old_data?.name ?? 'Unknown';
  const detail = formatHistoryDetail(entry);
  const when = new Date(entry.changed_at).toLocaleString('en-IE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const actionLabel = entry.action === 'created' ? 'Created' : entry.action === 'updated' ? 'Updated' : 'Deleted';
  const actionVariant = entry.action === 'created' ? 'success' : entry.action === 'updated' ? 'default' : 'danger';

  return (
    <li className="flex items-baseline justify-between gap-4 py-3 border-b border-[var(--color-border)] last:border-0 text-body text-[var(--color-text)]">
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
    </li>
  );
}

function formatHistoryDetail(entry: MasterBudgetHistoryEntry): string {
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
    if (entry.old_data.budget_type !== entry.new_data.budget_type) {
      parts.push(`type: ${entry.old_data.budget_type} → ${entry.new_data.budget_type}`);
    }
    return parts.length ? parts.join('; ') : 'details updated';
  }
  return '';
}

function BudgetTypeBadge({ type }: { type: BudgetType }) {
  const isFixed = type === 'Fixed';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-small font-medium ${
        isFixed
          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
          : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
      }`}
    >
      {isFixed ? <LockIcon className="w-3 h-3" /> : <VariableIcon className="w-3 h-3" />}
      {type}
    </span>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function VariableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
