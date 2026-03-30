'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { TransferService, SettingsService } from '@/lib/services';
import { Transfer, TransferType } from '@/lib/supabase/database.types';
import { validateBankType, DEFAULT_PAYMENT_METHODS } from '@/lib/utils/payment-methods';

const TYPE_LABELS: Record<TransferType, string> = {
  budget_to_budget: 'Budget → Budget',
  goal_to_budget: 'Goal → Budget',
  goal_drawdown: 'Goal Drawdown',
};

export default function EditTransferPage({
  params,
}: {
  params: Promise<{ id: string; transferId: string }>;
}) {
  const { id: monthId, transferId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [transferRoute, setTransferRoute] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>(DEFAULT_PAYMENT_METHODS);
  const [formData, setFormData] = useState({
    amount: '',
    date: '',
    bank: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/months/${monthId}`);
          return;
        }

        const transferService = new TransferService(supabase);
        const data = await transferService.getById(transferId);
        setTransfer(data);

        // Resolve route names
        let route = TYPE_LABELS[data.transfer_type];
        if (data.transfer_type === 'budget_to_budget') {
          const [fromRes, toRes] = await Promise.all([
            data.from_budget_id ? supabase.from('budgets').select('name').eq('id', data.from_budget_id).single() : null,
            data.to_budget_id ? supabase.from('budgets').select('name').eq('id', data.to_budget_id).single() : null,
          ]);
          const fromName = fromRes?.data?.name ?? 'Budget';
          const toName = toRes?.data?.name ?? 'Budget';
          route = `${fromName} → ${toName}`;
        } else if (data.transfer_type === 'goal_to_budget') {
          const [goalRes, toRes] = await Promise.all([
            data.from_goal_id ? supabase.from('financial_goals').select('name').eq('id', data.from_goal_id).single() : null,
            data.to_budget_id ? supabase.from('budgets').select('name').eq('id', data.to_budget_id).single() : null,
          ]);
          const goalName = goalRes?.data?.name ?? 'Goal';
          const toName = toRes?.data?.name ?? 'Budget';
          route = `${goalName} → ${toName}`;
        } else if (data.transfer_type === 'goal_drawdown') {
          const goalRes = data.from_goal_id
            ? await supabase.from('financial_goals').select('name').eq('id', data.from_goal_id).single()
            : null;
          route = `${goalRes?.data?.name ?? 'Goal'} → DrawDown`;
        }
        setTransferRoute(route);

        // Load payment methods
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        const methodsToUse = methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(methodsToUse);

        setFormData({
          amount: data.amount.toString(),
          date: data.date,
          bank: data.bank || '',
          description: data.description || '',
          notes: data.notes || '',
        });
      } catch (err) {
        console.error('Error fetching transfer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transfer');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [transferId, monthId, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const transferService = new TransferService(supabase);
      const amount = parseFloat(formData.amount);

      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsSaving(false);
        return;
      }

      await transferService.update(transferId, {
        amount,
        date: formData.date,
        bank: validateBankType(formData.bank) ?? null,
        description: formData.description || null,
        notes: formData.notes || null,
      });

      router.push(`/months/${monthId}/transfers`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transfer');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card variant="raised" padding="lg">
          <div className="text-center py-8">
            <p className="text-body text-[var(--color-text-muted)]">Loading transfer...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card variant="raised" padding="lg" className="text-center">
          <h2 className="text-title text-[var(--color-text)] mb-2">Transfer Not Found</h2>
          <p className="text-body text-[var(--color-text-muted)] mb-4">
            The transfer you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button variant="secondary" onClick={() => router.push(`/months/${monthId}/transfers`)}>
            Back to Transfers
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Edit Transfer"
        subtitle={transferRoute}
        actions={
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </button>
        }
      />

      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Transfer Info (read-only) */}
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-[var(--color-text-muted)]">Transfer Type</p>
                <p className="text-body font-medium text-[var(--color-text)]">
                  {TYPE_LABELS[transfer.transfer_type]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-caption text-[var(--color-text-muted)]">Route</p>
                <p className="text-body font-medium text-[var(--color-text)]">{transferRoute}</p>
              </div>
            </div>
          </div>

          {/* Amount */}
          <Input
            label="Amount (€)"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            required
          />

          {/* Date */}
          <Input
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            required
          />

          {/* Payment Method */}
          <Select
            label="Payment Method"
            name="bank"
            value={formData.bank}
            onChange={handleChange}
            options={[{ value: '', label: 'Select...' }, ...paymentMethods]}
          />

          {/* Description */}
          <Input
            label="Description (optional)"
            name="description"
            type="text"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional"
          />

          {/* Notes */}
          <Textarea
            label="Notes (optional)"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Optional"
            rows={2}
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              size="lg"
              isLoading={isSaving}
              className="flex-1"
            >
              <CheckIcon className="w-5 h-5" />
              Save Changes
            </Button>
          </div>
        </form>

        {/* Delete */}
        <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
          <button
            type="button"
            disabled={isDeleting}
            onClick={async () => {
              if (!confirm('Are you sure you want to delete this transfer? This will reverse the budget/goal balance changes.')) return;
              setIsDeleting(true);
              setError(null);
              try {
                const supabase = createSupabaseBrowserClient();
                const transferService = new TransferService(supabase);
                await transferService.delete(transferId);
                router.push(`/months/${monthId}/transfers`);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete transfer');
                setIsDeleting(false);
              }
            }}
            className="flex items-center gap-2 text-small text-[var(--color-danger)] hover:underline disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete this transfer'}
          </button>
        </div>
      </Card>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
