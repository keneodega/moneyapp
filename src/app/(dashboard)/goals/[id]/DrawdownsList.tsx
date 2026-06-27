'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Transfer, TransferType } from '@/lib/supabase/database.types';

const PAGE_SIZE = 10;

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

function getTransferTypeLabel(transferType: TransferType): string {
  switch (transferType) {
    case 'budget_to_budget':
      return 'Budget → Budget';
    case 'goal_to_budget':
      return 'Goal → Budget';
    case 'goal_drawdown':
      return 'Draw down';
    default:
      return 'Transfer';
  }
}

export function DrawdownsList({ transfers }: { transfers: Transfer[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const totalOut = transfers.reduce((sum, t) => {
    const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20">
        <div className="flex justify-between items-center">
          <span className="text-small text-[var(--color-text-muted)]">Total Transfers Out</span>
          <span className="text-body font-medium text-[var(--color-danger)] tabular-nums">
            {formatCurrency(totalOut)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {transfers.slice(0, visibleCount).map((transfer) => (
          <Link
            key={transfer.id}
            href={`/months/${transfer.monthly_overview_id}`}
            className="block p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <p className="text-body font-medium text-[var(--color-text)]">
                  {transfer.description || getTransferTypeLabel(transfer.transfer_type)}
                </p>
                <p className="text-small text-[var(--color-text-muted)]">
                  {getTransferTypeLabel(transfer.transfer_type)} • {formatDate(transfer.date)}
                  {transfer.bank && ` • ${transfer.bank}`}
                </p>
                {transfer.notes && (
                  <p className="text-caption text-[var(--color-text-muted)] mt-1">{transfer.notes}</p>
                )}
              </div>
              <span className="text-body font-medium text-[var(--color-danger)] tabular-nums ml-4">
                {formatCurrency(typeof transfer.amount === 'string' ? parseFloat(transfer.amount) : Number(transfer.amount || 0))}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {visibleCount < transfers.length && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 rounded-[var(--radius-md)] text-small font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            Show more ({transfers.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
