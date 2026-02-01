'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, BudgetProgress, Currency, BulkActionsBar } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService } from '@/lib/services';
import { useSelection } from '@/lib/hooks/useSelection';

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'budget-desc'
  | 'budget-asc'
  | 'spent-desc'
  | 'spent-asc'
  | 'percent-desc'
  | 'percent-asc';

interface BudgetItem {
  id: string;
  name: string;
  budget_amount: number;
  amount_spent: number;
  amount_left: number;
  percent_used?: number;
  description?: string;
  master_budget_id?: string;
  override_amount?: number | null;
  override_reason?: string | null;
  master_budget?: { budget_amount: number; name: string; budget_type?: string } | null;
  budget_type?: 'Fixed' | 'Variable';
}

interface PreviousBudgetInfo {
  amount_spent: number;
  budget_amount: number;
}

interface BudgetCategoriesListProps {
  budgets: BudgetItem[];
  monthId: string;
  /** Previous month's budgets by name, for % change display */
  previousBudgetsByName?: Record<string, PreviousBudgetInfo> | null;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'budget-desc', label: 'Budget (High-Low)' },
  { value: 'budget-asc', label: 'Budget (Low-High)' },
  { value: 'spent-desc', label: 'Spent (High-Low)' },
  { value: 'spent-asc', label: 'Spent (Low-High)' },
  { value: 'percent-desc', label: '% Used (High-Low)' },
  { value: 'percent-asc', label: '% Used (Low-High)' },
];

type TypeFilter = 'all' | 'Fixed' | 'Variable';
type StatusFilter = 'all' | 'over' | 'under' | 'on-track';

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr !== 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

export function BudgetCategoriesList({
  budgets,
  monthId,
  previousBudgetsByName,
}: BudgetCategoriesListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const router = useRouter();

  const selection = useSelection(budgets);

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (!confirm(`Delete ${selection.selectedIds.length} budget categor${selection.selectedIds.length === 1 ? 'y' : 'ies'}? All expenses in these budgets will be removed.`)) return;
    setBulkDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const service = new BudgetService(supabase);
      await service.deleteMany(selection.selectedIds);
      selection.clear();
      setSelectionModeActive(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete budgets:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete budgets.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredAndSortedBudgets = useMemo(() => {
    if (!budgets || budgets.length === 0) return [];
    let arr = [...budgets];
    const effectiveAmount = (b: BudgetItem) =>
      b.override_amount ?? Number(b.budget_amount);

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      arr = arr.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.description?.toLowerCase().includes(q) ?? false)
      );
    }

    // Apply type filter (Fixed / Variable)
    if (typeFilter !== 'all') {
      const type = typeFilter as 'Fixed' | 'Variable';
      arr = arr.filter(
        (b) => (b.budget_type ?? b.master_budget?.budget_type) === type
      );
    }

    // Apply status filter (over / under / on-track)
    if (statusFilter !== 'all') {
      arr = arr.filter((b) => {
        const spent = b.amount_spent ?? 0;
        const total = effectiveAmount(b);
        const pct = total > 0 ? (spent / total) * 100 : 0;
        if (statusFilter === 'over') return pct > 100;
        if (statusFilter === 'under') return pct < 80;
        if (statusFilter === 'on-track') return pct >= 80 && pct <= 100;
        return true;
      });
    }

    arr.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'budget-desc':
          return effectiveAmount(b) - effectiveAmount(a);
        case 'budget-asc':
          return effectiveAmount(a) - effectiveAmount(b);
        case 'spent-desc':
          return (b.amount_spent || 0) - (a.amount_spent || 0);
        case 'spent-asc':
          return (a.amount_spent || 0) - (b.amount_spent || 0);
        case 'percent-desc':
          return (b.percent_used || 0) - (a.percent_used || 0);
        case 'percent-asc':
          return (a.percent_used || 0) - (b.percent_used || 0);
        default:
          return 0;
      }
    });
    return arr;
  }, [budgets, sortBy, searchQuery, typeFilter, statusFilter]);

  if (!budgets || budgets.length === 0) {
    return null;
  }

  const hasActiveFilters = searchQuery.trim() || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {selectionModeActive ? (
            <>
              <label className="flex items-center gap-2 cursor-pointer text-small text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={selection.isAllSelected}
                  onChange={selection.toggleAll}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                />
                {selection.isAllSelected ? 'Deselect all' : 'Select all'}
              </label>
              <button
                type="button"
                onClick={() => { setSelectionModeActive(false); selection.clear(); }}
                className="h-8 px-3 rounded-[var(--radius-md)] text-small font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
              >
                Done
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setSelectionModeActive(true); selection.selectAll(); }}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-[var(--radius-md)] text-small font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]"
            >
              Select all
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 h-8 px-3 rounded-[var(--radius-md)] border text-small font-medium transition-colors ${
              hasActiveFilters
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
            aria-expanded={showFilters}
          >
            <FilterIcon className="w-4 h-4" />
            Filter
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
            )}
          </button>
          <label className="text-caption text-[var(--color-text-muted)]">
            Sort by
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-8 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-default)] text-small text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-caption text-[var(--color-text-muted)] mb-1">Search by name</label>
              <input
                type="search"
                placeholder="e.g. Food, Transport..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-default)] text-small text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            <div>
              <label className="block text-caption text-[var(--color-text-muted)] mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="w-full h-8 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-default)] text-small text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                <option value="all">All</option>
                <option value="Fixed">Fixed</option>
                <option value="Variable">Variable</option>
              </select>
            </div>
            <div>
              <label className="block text-caption text-[var(--color-text-muted)] mb-1">Spending status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full h-8 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-default)] text-small text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                <option value="all">All</option>
                <option value="over">Over budget</option>
                <option value="under">Under budget (&lt;80%)</option>
                <option value="on-track">On track (80–100%)</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  }}
                  className="h-8 px-3 rounded-[var(--radius-md)] text-small font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-default)]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <p className="text-caption text-[var(--color-text-muted)]">
            Showing {filteredAndSortedBudgets.length} of {budgets.length} categories
          </p>
        </div>
      )}

      {selectionModeActive && selection.isSomeSelected && (
        <BulkActionsBar
          selectedCount={selection.selectedCount}
          itemLabel="categories"
          onClear={selection.clear}
          onDelete={handleBulkDelete}
          isDeleting={bulkDeleting}
        />
      )}

      <div className="grid gap-3">
        {filteredAndSortedBudgets.map((budget) => {
          const percent =
            budget.budget_amount > 0
              ? (budget.amount_spent / budget.budget_amount) * 100
              : 0;
          const masterAmount = budget.master_budget?.budget_amount;
          const effectiveAmount =
            budget.override_amount ?? budget.budget_amount;
          const deviation =
            masterAmount && Math.abs(effectiveAmount - masterAmount) > 0.01
              ? effectiveAmount - masterAmount
              : null;
          const deviationPercent =
            deviation && masterAmount && masterAmount > 0
              ? ((deviation / masterAmount) * 100).toFixed(1)
              : null;

          // Month-over-month change for this category
          const prevCat = previousBudgetsByName?.[budget.name];
          const spentChange =
            prevCat != null
              ? pctChange(budget.amount_spent, prevCat.amount_spent)
              : null;
          const budgetChange =
            prevCat != null
              ? pctChange(effectiveAmount, prevCat.budget_amount)
              : null;

          return (
            <div key={budget.id} className="flex gap-3">
              {selectionModeActive && (
                <label className="flex-shrink-0 pt-4 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selection.isSelected(budget.id)}
                    onChange={() => selection.toggle(budget.id)}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
              )}
              <Link href={`/months/${monthId}/budgets/${budget.id}`} className="flex-1 min-w-0">
              <Card variant="outlined" padding="md" hover>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-body font-medium text-[var(--color-text)]">
                      {budget.name}
                    </h3>
                    {deviation !== null && (
                      <p
                        className={`text-caption mt-0.5 ${
                          deviation > 0
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-success)]'
                        }`}
                      >
                        {deviation > 0 ? '↑' : '↓'}{' '}
                        {deviation > 0 ? '+' : ''}€
                        {Math.abs(deviation).toLocaleString('en-IE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        {deviationPercent &&
                          ` (${deviation > 0 ? '+' : ''}${deviationPercent}%)`}{' '}
                        from master
                      </p>
                    )}
                    {budget.override_reason && (
                      <p className="text-caption text-[var(--color-text-muted)] mt-0.5 italic">
                        &quot;{budget.override_reason}&quot;
                      </p>
                    )}
                    {(spentChange != null || budgetChange != null) && (
                      <p className="text-caption text-[var(--color-text-muted)] mt-0.5">
                        vs last month:{' '}
                        {spentChange != null && (
                          <span
                            className={
                              spentChange > 0
                                ? 'text-[var(--color-warning)]'
                                : spentChange < 0
                                  ? 'text-[var(--color-success)]'
                                  : ''
                            }
                          >
                            Spent {spentChange > 0 ? '+' : ''}{spentChange.toFixed(1)}%
                          </span>
                        )}
                        {spentChange != null && budgetChange != null && ' · '}
                        {budgetChange != null && (
                          <span
                            className={
                              budgetChange > 0
                                ? 'text-[var(--color-warning)]'
                                : budgetChange < 0
                                  ? 'text-[var(--color-success)]'
                                  : ''
                            }
                          >
                            Budget {budgetChange > 0 ? '+' : ''}{budgetChange.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                    <Currency amount={effectiveAmount} size="sm" />
                  </span>
                </div>
                <BudgetProgress spent={budget.amount_spent} total={effectiveAmount} />
              </Card>
            </Link>
            </div>
          );
        })}
      </div>

      {filteredAndSortedBudgets.length === 0 && budgets.length > 0 && (
        <p className="py-6 text-center text-small text-[var(--color-text-muted)]">
          No categories match your filters. Try adjusting or clearing them.
        </p>
      )}
    </div>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  );
}
