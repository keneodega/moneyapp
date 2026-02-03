import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, DashboardTile, PageHeader } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type TransferType = 'budget_to_budget' | 'goal_to_budget' | 'goal_drawdown';

interface TransferRow {
  id: string;
  transfer_type: TransferType;
  amount: number;
  date: string;
  description?: string | null;
  notes?: string | null;
  bank?: string | null;
  from_budget?: { name: string | null } | null;
  to_budget?: { name: string | null } | null;
  from_goal?: { name: string | null } | null;
}

const TYPE_LABELS: Record<TransferType, string> = {
  budget_to_budget: 'Budget → Budget',
  goal_to_budget: 'Goal → Budget',
  goal_drawdown: 'Goal Drawdown',
};

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

function getTransferRoute(transfer: TransferRow): string {
  if (transfer.transfer_type === 'budget_to_budget') {
    return `${transfer.from_budget?.name ?? 'Budget'} → ${transfer.to_budget?.name ?? 'Budget'}`;
  }
  if (transfer.transfer_type === 'goal_to_budget') {
    return `${transfer.from_goal?.name ?? 'Goal'} → ${transfer.to_budget?.name ?? 'Budget'}`;
  }
  return `${transfer.from_goal?.name ?? 'Goal'} → DrawDown`;
}

export default async function TransfersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: month } = await supabase
    .from('monthly_overviews')
    .select('id, name, start_date, end_date')
    .eq('id', id)
    .single();

  if (!month) {
    notFound();
  }

  const { data: transfers } = await supabase
    .from('transfers')
    .select(`
      id,
      transfer_type,
      amount,
      date,
      description,
      notes,
      bank,
      from_budget:budgets!transfers_from_budget_id_fkey(name),
      to_budget:budgets!transfers_to_budget_id_fkey(name),
      from_goal:financial_goals!transfers_from_goal_id_fkey(name)
    `)
    .eq('monthly_overview_id', id)
    .order('date', { ascending: false });

  const rows = (transfers ?? []).map((row: any) => ({
    ...row,
    from_budget: Array.isArray(row.from_budget) ? row.from_budget[0] ?? null : row.from_budget ?? null,
    to_budget: Array.isArray(row.to_budget) ? row.to_budget[0] ?? null : row.to_budget ?? null,
    from_goal: Array.isArray(row.from_goal) ? row.from_goal[0] ?? null : row.from_goal ?? null,
  })) as TransferRow[];
  const totalAmount = rows.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const byType = rows.reduce<Record<TransferType, number>>((acc, t) => {
    acc[t.transfer_type] = (acc[t.transfer_type] || 0) + 1;
    return acc;
  }, { budget_to_budget: 0, goal_to_budget: 0, goal_drawdown: 0 });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Transfers"
        subtitle={`${month.name} · ${formatDate(month.start_date)} - ${formatDate(month.end_date)}`}
        actions={
          <Link
            href={`/months/${id}`}
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <DashboardTile
          title="Total Transfers"
          value={String(rows.length)}
          helper="All transfer types"
          tone="primary"
        />
        <DashboardTile
          title="Total Amount"
          value={formatCurrency(totalAmount)}
          helper="Moved this month"
          tone="default"
        />
        <DashboardTile
          title="Budget → Budget"
          value={String(byType.budget_to_budget)}
          helper="Internal reallocations"
          tone="default"
        />
        <DashboardTile
          title="Goal Transfers"
          value={String(byType.goal_to_budget + byType.goal_drawdown)}
          helper="Goal outflows"
          tone="warning"
        />
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card variant="outlined" padding="lg" className="text-center">
            <p className="text-body text-[var(--color-text-muted)]">No transfers recorded for this month.</p>
          </Card>
        ) : (
          rows.map((transfer) => (
            <Card key={transfer.id} variant="outlined" padding="md" hover>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {getTransferRoute(transfer)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-caption text-[var(--color-text-muted)]">
                    <span>{TYPE_LABELS[transfer.transfer_type]}</span>
                    <span>•</span>
                    <span>{formatDate(transfer.date)}</span>
                    {transfer.bank && (
                      <>
                        <span>•</span>
                        <span>{transfer.bank}</span>
                      </>
                    )}
                    {transfer.description && (
                      <>
                        <span>•</span>
                        <span>{transfer.description}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-body font-medium text-[var(--color-text)] tabular-nums">
                    {formatCurrency(transfer.amount)}
                  </p>
                  {transfer.notes && (
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">{transfer.notes}</p>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}
