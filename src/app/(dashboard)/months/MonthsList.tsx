'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, BulkActionsBar } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MonthlyOverviewService } from '@/lib/services';
import { useSelection } from '@/lib/hooks/useSelection';

interface MonthData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_income?: number;
  total_budgeted?: number;
  total_spent?: number;
  amount_unallocated?: number;
}

interface MonthsListProps {
  months: MonthData[];
  groupedByYear: Record<string, MonthData[]>;
  years: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isCurrentMonth(startDate: string, endDate: string): boolean {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
}

export function MonthsList({ months, groupedByYear, years }: MonthsListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const selection = useSelection(months);

  const handleBulkDelete = async () => {
    if (selection.selectedIds.length === 0) return;
    if (!confirm(`Delete ${selection.selectedIds.length} month(s)? This will remove all budgets, expenses, and income for those months.`)) return;
    setDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const service = new MonthlyOverviewService(supabase);
      await service.deleteMany(selection.selectedIds);
      selection.clear();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete months:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete months.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSingleDelete = async (e: React.MouseEvent, monthId: string, monthName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${monthName}"? This will remove all budgets, expenses, and income for this month.`)) return;
    setDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const service = new MonthlyOverviewService(supabase);
      await service.delete(monthId);
      selection.clear();
      router.refresh();
    } catch (error) {
      console.error('Failed to delete month:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete month.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {months.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
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
      )}
      {selection.isSomeSelected && (
        <BulkActionsBar
          selectedCount={selection.selectedCount}
          itemLabel="months"
          onClear={selection.clear}
          onDelete={handleBulkDelete}
          isDeleting={deleting}
        />
      )}

      {years.map((year, yearIndex) => (
        <section key={year} className={`animate-slide-up stagger-${yearIndex + 1}`}>
          <h2 className="text-headline text-[var(--color-text)] mb-4">{year}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupedByYear[year].map((month, monthIndex) => {
              const isCurrent = isCurrentMonth(month.start_date, month.end_date);
              const spentPercent = month.total_budgeted
                ? ((month.total_spent || 0) / month.total_budgeted) * 100
                : 0;

              return (
                <div
                  key={month.id}
                  className={`animate-slide-up stagger-${monthIndex + 1}`}
                >
                  <Card
                    variant={isCurrent ? 'raised' : 'outlined'}
                    hover
                    padding="md"
                    className={`relative ${isCurrent ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}
                  >
                    <div className="flex gap-3">
                      <label className="flex-shrink-0 pt-0.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selection.isSelected(month.id)}
                          onChange={() => selection.toggle(month.id)}
                          className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                      <Link href={`/months/${month.id}`} className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-title text-[var(--color-text)]">{month.name}</h3>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-caption font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                                Current
                              </span>
                            )}
                          </div>
                          <ChevronRightIcon className="w-5 h-5 text-[var(--color-text-subtle)] flex-shrink-0" />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-small text-[var(--color-text-muted)]">Income</span>
                            <span className="text-small font-medium text-[var(--color-success)] tabular-nums">
                              {formatCurrency(month.total_income || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-small text-[var(--color-text-muted)]">Budgeted</span>
                            <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                              {formatCurrency(month.total_budgeted || 0)}
                            </span>
                          </div>
                          <div className="pt-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-caption text-[var(--color-text-muted)]">Spent</span>
                              <span className="text-caption text-[var(--color-text-muted)] tabular-nums">
                                {spentPercent.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  spentPercent >= 100
                                    ? 'bg-[var(--color-danger)]'
                                    : spentPercent >= 80
                                      ? 'bg-[var(--color-warning)]'
                                      : 'bg-[var(--color-accent)]'
                                }`}
                                style={{ width: `${Math.min(100, spentPercent)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => handleSingleDelete(e, month.id, month.name)}
                        disabled={deleting}
                        className="flex-shrink-0 p-2 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete month"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
