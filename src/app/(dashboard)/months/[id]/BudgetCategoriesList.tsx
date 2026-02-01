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
  master_budget?: { budget_amount: number; name: string } | null;
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
      router.refresh();
    } catch (error) {
      console.error('Failed to delete budgets:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete budgets.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const sortedBudgets = useMemo(() => {
    if (!budgets || budgets.length === 0) return [];
    const arr = [...budgets];
    const effectiveAmount = (b: BudgetItem) =>
      b.override_amount ?? Number(b.budget_amount);

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
  }, [budgets, sortBy]);

  if (!budgets || budgets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-small text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={selection.isAllSelected}
              onChange={selection.toggleAll}
              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            {selection.isAllSelected ? 'Deselect all' : 'Select all'}
          </label>
          <label className="text-caption text-[var(--color-text-muted)]">
            Sort by
          </label>
        </div>
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

      {selection.isSomeSelected && (
        <BulkActionsBar
          selectedCount={selection.selectedCount}
          itemLabel="categories"
          onClear={selection.clear}
          onDelete={handleBulkDelete}
          isDeleting={bulkDeleting}
        />
      )}

      <div className="grid gap-3">
        {sortedBudgets.map((budget, index) => {
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
              <label className="flex-shrink-0 pt-4 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selection.isSelected(budget.id)}
                  onChange={() => selection.toggle(budget.id)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
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
    </div>
  );
}
