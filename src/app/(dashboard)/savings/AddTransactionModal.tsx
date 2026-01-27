'use client';

import { useState } from 'react';
import { Card, Button, Input, Select, Textarea, useToast } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SavingsService } from '@/lib/services';
import { ValidationError } from '@/lib/services/errors';

interface AddTransactionModalProps {
  bucketId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTransactionModal({ bucketId, onClose, onSuccess }: AddTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    transaction_type: 'deposit' as 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const toast = useToast();
  const supabase = createSupabaseBrowserClient();
  const savingsService = new SavingsService(supabase);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await savingsService.createTransaction({
        savings_bucket_id: bucketId,
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        date: formData.date,
        description: formData.description || null,
      });

      toast.showToast('Transaction added successfully', 'success');
      onSuccess();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add transaction');
      }
      toast.showToast('Failed to add transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card variant="raised" padding="lg" className="w-full max-w-md">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-headline text-[var(--color-text)]">Add Transaction</h2>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Transaction Type *
              </label>
              <Select
                value={formData.transaction_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    transaction_type: e.target.value as any,
                  })
                }
                options={[
                  { value: 'deposit', label: 'Deposit' },
                  { value: 'withdrawal', label: 'Withdrawal' },
                  { value: 'transfer_in', label: 'Transfer In' },
                  { value: 'transfer_out', label: 'Transfer Out' },
                ]}
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Amount *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Date *
              </label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
                Description (optional)
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Add notes about this transaction..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                {loading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
