import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TransferService } from '@/lib/services';
import type { TransferType } from '@/lib/supabase/database.types';

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

async function getTransfers(goalId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const transferService = new TransferService(supabase);
    const transfers = await transferService.getByGoal(goalId);
    return transfers.slice(0, 10);
  } catch (error) {
    console.error('Error fetching transfers for goal:', error);
    return [];
  }
}

export async function Drawdowns({ goalId }: { goalId: string }) {
  const transfers = await getTransfers(goalId);

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No transfers from this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Use the &quot;Transfer&quot; button to move money from this goal to a budget or DrawDown.
        </p>
      </div>
    );
  }

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
        {transfers.map((transfer: { id: string; amount: number | string; date: string; description?: string | null; bank?: string | null; notes?: string | null; transfer_type: TransferType; monthly_overview_id: string }) => (
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

      {transfers.length >= 10 && (
        <p className="text-caption text-[var(--color-text-muted)] text-center pt-2">
          Showing latest 10 transfers
        </p>
      )}
    </div>
  );
}
