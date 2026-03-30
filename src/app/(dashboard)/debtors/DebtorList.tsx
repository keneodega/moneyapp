'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Debtor, DebtorStatusType } from '@/lib/supabase/database.types';
import { DebtorService } from '@/lib/services';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';

interface DebtorListProps {
  debtors: Debtor[];
}

const statusColors: Record<DebtorStatusType, string> = {
  Active: 'bg-blue-500/10 text-blue-400',
  'Partially Paid': 'bg-yellow-500/10 text-yellow-400',
  'Paid Off': 'bg-green-500/10 text-green-400',
  'Written Off': 'bg-gray-500/10 text-gray-400',
};

export function DebtorList({ debtors }: DebtorListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | DebtorStatusType>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const filteredDebtors = debtors.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const handleMarkPaidOff = async (id: string) => {
    if (!confirm('Mark this debt as fully paid off?')) return;

    setLoading(id);
    try {
      const service = new DebtorService(supabase);
      await service.markAsPaidOff(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to mark debtor as paid off:', error);
      alert('Failed to update. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleWriteOff = async (id: string) => {
    if (!confirm('Write off this debt? This means you no longer expect to be repaid.')) return;

    setLoading(id);
    try {
      const service = new DebtorService(supabase);
      await service.markAsWrittenOff(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to write off debtor:', error);
      alert('Failed to update. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this debtor? This will also delete all payment history.')) return;

    setLoading(id);
    try {
      const service = new DebtorService(supabase);
      await service.delete(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete debtor:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateProgress = (debtor: Debtor) => {
    const owed = Number(debtor.amount_owed);
    if (owed === 0) return 0;
    return (Number(debtor.amount_repaid) / owed) * 100;
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'Active', 'Partially Paid', 'Paid Off', 'Written Off'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-[var(--radius-md)] text-small font-medium transition-colors ${
              statusFilter === status
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {status === 'all' ? 'All' : status}
            <span className="ml-1 opacity-60">
              ({status === 'all' ? debtors.length : debtors.filter(d => d.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Debtor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDebtors.map((debtor) => {
          const progress = calculateProgress(debtor);
          const remaining = Number(debtor.amount_owed) - Number(debtor.amount_repaid);
          const isOverdue = debtor.expected_repayment_date &&
            debtor.expected_repayment_date < new Date().toISOString().split('T')[0] &&
            (debtor.status === 'Active' || debtor.status === 'Partially Paid');

          return (
            <Card key={debtor.id} variant="outlined" padding="md" className="relative group">
              {loading === debtor.id && (
                <div className="absolute inset-0 bg-[var(--color-surface)]/80 flex items-center justify-center rounded-[var(--radius-lg)] z-10">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-title text-[var(--color-text)]">{debtor.debtor_name}</h3>
                    {isOverdue && (
                      <span className="px-1.5 py-0.5 rounded text-caption font-medium bg-red-500/10 text-red-400">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-small text-[var(--color-text-muted)]">
                    Lent on {formatDate(debtor.date_lent)}
                    {debtor.person && ` · ${debtor.person}`}
                    {debtor.bank && ` · ${debtor.bank}`}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-small ${statusColors[debtor.status]}`}>
                  {debtor.status}
                </span>
              </div>

              {/* Progress Bar */}
              {(debtor.status === 'Active' || debtor.status === 'Partially Paid') && (
                <div className="mb-4">
                  <div className="flex justify-between text-small text-[var(--color-text-muted)] mb-1">
                    <span>Repaid</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-success)] transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Amount Owed</p>
                  <p className="text-body font-medium text-[var(--color-text)]">
                    <Currency amount={Number(debtor.amount_owed)} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Amount Repaid</p>
                  <p className="text-body font-medium text-[var(--color-success)]">
                    <Currency amount={Number(debtor.amount_repaid)} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Remaining</p>
                  <p className="text-body font-medium text-[var(--color-primary)]">
                    <Currency amount={remaining} />
                  </p>
                </div>
                <div>
                  <p className="text-small text-[var(--color-text-muted)]">Expected Repayment</p>
                  <p className={`text-body text-[var(--color-text)] ${isOverdue ? 'text-red-400' : ''}`}>
                    {formatDate(debtor.expected_repayment_date)}
                  </p>
                </div>
              </div>

              {debtor.description && (
                <p className="mb-4 text-small text-[var(--color-text-muted)] line-clamp-2">
                  {debtor.description}
                </p>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-[var(--color-border)] flex items-center gap-2 flex-wrap">
                <Link
                  href={`/debtors/${debtor.id}/edit`}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Edit
                </Link>

                <Link
                  href={`/debtors/${debtor.id}/payments`}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  Payments
                </Link>

                {(debtor.status === 'Active' || debtor.status === 'Partially Paid') && (
                  <>
                    <button
                      onClick={() => handleMarkPaidOff(debtor.id)}
                      className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => handleWriteOff(debtor.id)}
                      className="px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors"
                    >
                      Write Off
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleDelete(debtor.id)}
                  className="ml-auto px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredDebtors.length === 0 && (
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">
            No {statusFilter === 'all' ? '' : statusFilter.toLowerCase()} debtors found.
          </p>
        </Card>
      )}
    </div>
  );
}
