'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, BulkActionsBar } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ExpenseService } from '@/lib/services';
import { useSelection } from '@/lib/hooks/useSelection';

interface Expense {
  id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: string | null;
}

interface ExpenseListProps {
  expenses: Expense[];
  monthId: string;
  budgetId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ExpenseList({ expenses, monthId, budgetId }: ExpenseListProps) {
  const router = useRouter();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selection = useSelection(expenses);

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (!confirm(`Delete ${selection.selectedIds.length} expense(s)?`)) return;
    setBulkDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const service = new ExpenseService(supabase);
      await service.deleteMany(selection.selectedIds);
      selection.clear();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete expenses:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete expenses.');
    } finally {
      setBulkDeleting(false);
    }
  };

  if (expenses.length === 0) {
    return (
      <Card variant="outlined" padding="lg" className="text-center">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No expenses recorded in this budget yet.
        </p>
        <Link
          href={`/months/${monthId}/expense/new?budget=${budgetId}`}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add First Expense
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer text-small text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={selection.isAllSelected}
            onChange={selection.toggleAll}
            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
          />
          {selection.isAllSelected ? 'Deselect all' : 'Select all'}
        </label>
      </div>
      {selection.isSomeSelected && (
        <BulkActionsBar
          selectedCount={selection.selectedCount}
          itemLabel="expenses"
          onClear={selection.clear}
          onDelete={handleBulkDelete}
          isDeleting={bulkDeleting}
        />
      )}
      <Card variant="outlined" padding="none">
        <div className="divide-y divide-[var(--color-border)]">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center gap-3 p-4 hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <label className="flex-shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selection.isSelected(expense.id)}
                  onChange={() => selection.toggle(expense.id)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
              <Link
                href={`/months/${monthId}/expense/${expense.id}/edit`}
                className="flex-1 min-w-0 flex items-center justify-between"
              >
                <div>
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {expense.description || 'Expense'}
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {formatDate(expense.date)}
                    {expense.bank && ` · ${expense.bank}`}
                  </p>
                </div>
                <span className="text-body font-medium text-[var(--color-text)] tabular-nums ml-4">
                  -{formatCurrency(expense.amount)}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </Card>
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
