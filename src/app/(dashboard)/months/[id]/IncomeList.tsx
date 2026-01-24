'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { IncomeSourceService } from '@/lib/services';
import { Card } from '@/components/ui';

interface IncomeItem {
  id: string;
  source: string;
  person?: string | null;
  amount: number;
  date_paid: string;
}

interface IncomeListProps {
  income: IncomeItem[];
  monthId: string;
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
  });
}

export function IncomeList({ income, monthId }: IncomeListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const service = new IncomeSourceService(supabase);
      await service.delete(id);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete income:', error);
      alert('Failed to delete income source. Please try again.');
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  if (income.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-small text-[var(--color-text-muted)]">
          No income recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {income.map((item) => (
        <div key={item.id} className="p-4 group">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-body font-medium text-[var(--color-text)]">
                {item.source}
              </p>
              <p className="text-small text-[var(--color-text-muted)]">
                {item.person} · {formatDate(item.date_paid)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-body font-medium text-[var(--color-success)] tabular-nums">
                +{formatCurrency(item.amount)}
              </span>
              
              {confirmDelete === item.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="px-2 py-1 rounded text-small font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting === item.id ? '...' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    disabled={deleting === item.id}
                    className="px-2 py-1 rounded text-small font-medium bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete income"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
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
