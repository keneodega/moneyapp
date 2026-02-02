'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoalContributionService } from '@/lib/services';

interface ContributionItem {
  id: string;
  amount: number;
  date: string;
  description?: string | null;
  bank?: string | null;
  notes?: string | null;
  monthly_overview?: {
    id: string;
    name: string;
  } | null;
}

interface ContributionsProps {
  contributions: ContributionItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Contributions({ contributions }: ContributionsProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const service = new GoalContributionService(supabase);
      await service.delete(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete contribution:', error);
      alert('Failed to delete contribution. Please try again.');
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }, [supabase, router]);

  if (contributions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No contributions to this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Use the "Fund Goal" button on a month page to add contributions.
        </p>
      </div>
    );
  }

  const totalContributions = contributions.reduce((sum, contrib) => {
    const amount = typeof contrib.amount === 'string' ? parseFloat(contrib.amount) : Number(contrib.amount || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
        <div className="flex justify-between items-center">
          <span className="text-small text-[var(--color-text-muted)]">Total Contributions</span>
          <span className="text-body font-medium text-[var(--color-primary)] tabular-nums">
            {formatCurrency(totalContributions)}
          </span>
        </div>
      </div>

      {/* Contributions List */}
      <div className="space-y-2">
        {contributions.map((contrib) => {
          const monthlyOverview = contrib.monthly_overview;
          const monthId = monthlyOverview?.id || '';
          const monthName = monthlyOverview?.name || 'Unknown Month';

          // Link to month detail page
          const monthUrl = monthId ? `/months/${monthId}` : '#';

          return (
            <div
              key={contrib.id}
              className="group p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <Link href={monthUrl} className="flex-1">
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {contrib.description || 'Goal Contribution'}
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {monthName} • {formatDate(contrib.date)}
                    {contrib.bank && ` • ${contrib.bank}`}
                  </p>
                  {contrib.notes && (
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">
                      {contrib.notes}
                    </p>
                  )}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-[var(--color-success)] tabular-nums">
                    {formatCurrency(typeof contrib.amount === 'string' ? parseFloat(contrib.amount) : Number(contrib.amount || 0))}
                  </span>

                  {confirmDelete === contrib.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(contrib.id)}
                        disabled={deleting === contrib.id}
                        className="px-2 py-1 rounded text-small font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting === contrib.id ? '...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        disabled={deleting === contrib.id}
                        className="px-2 py-1 rounded text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(contrib.id)}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete contribution"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {contributions.length >= 10 && (
        <p className="text-caption text-[var(--color-text-muted)] text-center pt-2">
          Showing latest 10 contributions
        </p>
      )}
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
