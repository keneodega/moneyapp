'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DebtorService, SettingsService } from '@/lib/services';
import { Debtor, DebtorPayment } from '@/lib/supabase/database.types';
import { Card, Button, Input, PageHeader } from '@/components/ui';
import { Currency } from '@/components/ui/Currency';
import { validateBankType, DEFAULT_PAYMENT_METHODS } from '@/lib/utils/payment-methods';

export default function DebtorPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [payments, setPayments] = useState<DebtorPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);

  const [formData, setFormData] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });

  const loadData = useCallback(async (id: string) => {
    try {
      const service = new DebtorService(supabase);
      const [debtorData, paymentsData] = await Promise.all([
        service.getById(id),
        service.getPayments(id),
      ]);
      setDebtor(debtorData);
      setPayments(paymentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setDebtorId(id);

      try {
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        if (methods.length > 0) setPaymentMethods(methods);
      } catch {
        // Use defaults
      }

      await loadData(id);
      setIsLoading(false);
    }
    init();
  }, [params, supabase, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const service = new DebtorService(supabase);
      const amount = parseFloat(formData.payment_amount);

      if (isNaN(amount) || amount <= 0) {
        setError('Payment amount must be greater than zero');
        setIsSubmitting(false);
        return;
      }

      await service.recordPayment({
        debtor_id: debtorId,
        payment_amount: amount,
        payment_date: formData.payment_date,
        payment_method: validateBankType(formData.payment_method) ?? null,
        notes: formData.notes || null,
      });

      // Reset form and reload data
      setFormData({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: '',
        notes: '',
      });
      await loadData(debtorId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!debtorId) return;
    if (!confirm('Delete this payment? The debtor balance will be recalculated.')) return;

    setDeletingId(paymentId);
    try {
      const service = new DebtorService(supabase);
      await service.deletePayment(paymentId);
      await loadData(debtorId);
      router.refresh();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      alert('Failed to delete payment. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!debtor) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <h2 className="text-headline text-[var(--color-text)] mb-2">Debtor Not Found</h2>
          <Link
            href="/debtors"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Back to Debtors
          </Link>
        </Card>
      </div>
    );
  }

  const remaining = Number(debtor.amount_owed) - Number(debtor.amount_repaid);
  const progress = Number(debtor.amount_owed) > 0
    ? (Number(debtor.amount_repaid) / Number(debtor.amount_owed)) * 100
    : 0;
  const canRecordPayment = debtor.status === 'Active' || debtor.status === 'Partially Paid';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title={`${debtor.debtor_name} - Payments`}
        subtitle="Track repayments"
        actions={
          <Link
            href="/debtors"
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
          </Link>
        }
      />

      {/* Debtor Summary */}
      <Card variant="raised" padding="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Amount Owed</p>
              <p className="text-title font-medium text-[var(--color-text)]">
                <Currency amount={Number(debtor.amount_owed)} />
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Repaid</p>
              <p className="text-title font-medium text-[var(--color-success)]">
                <Currency amount={Number(debtor.amount_repaid)} />
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Remaining</p>
              <p className="text-title font-medium text-[var(--color-primary)]">
                <Currency amount={remaining} />
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-small text-[var(--color-text-muted)] mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-success)] transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Record Payment Form */}
      {canRecordPayment && (
        <Card variant="outlined" padding="lg">
          <h3 className="text-title text-[var(--color-text)] mb-4">Record Payment</h3>

          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/50 text-small text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Payment Amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                placeholder="0.00"
                required
              />
              <Input
                label="Payment Date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {paymentMethods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this payment..."
                rows={2}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </form>
        </Card>
      )}

      {/* Payment History */}
      <Card variant="outlined" padding="md">
        <h3 className="text-title text-[var(--color-text)] mb-4">
          Payment History ({payments.length})
        </h3>

        {payments.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)] text-center py-6">
            No payments recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="group flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
              >
                <div>
                  <p className="text-body font-medium text-[var(--color-success)]">
                    <Currency amount={Number(payment.payment_amount)} />
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {formatDate(payment.payment_date)}
                    {payment.payment_method && ` · ${payment.payment_method}`}
                  </p>
                  {payment.notes && (
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">
                      {payment.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeletePayment(payment.id)}
                  disabled={deletingId === payment.id}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  title="Delete payment"
                >
                  {deletingId === payment.id ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <TrashIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
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
