'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DebtorService, SettingsService } from '@/lib/services';
import { DebtorStatusType } from '@/lib/supabase/database.types';
import { Card, Button, Input, PageHeader } from '@/components/ui';
import { validateBankType, DEFAULT_PAYMENT_METHODS } from '@/lib/utils/payment-methods';

const statuses: DebtorStatusType[] = ['Active', 'Partially Paid', 'Paid Off', 'Written Off'];

const DEFAULT_PERSONS = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

export default function NewDebtorPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [persons, setPersons] = useState(DEFAULT_PERSONS);

  const [formData, setFormData] = useState({
    debtor_name: '',
    amount_owed: '',
    date_lent: new Date().toISOString().split('T')[0],
    expected_repayment_date: '',
    status: 'Active' as DebtorStatusType,
    bank: '',
    payment_method: '',
    person: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsService = new SettingsService(supabase);
        const [methods, people] = await Promise.all([
          settingsService.getPaymentMethods(),
          settingsService.getPeople(),
        ]);
        if (methods.length > 0) setPaymentMethods(methods);
        if (people.length > 0) setPersons(people);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const service = new DebtorService(supabase);
      await service.create({
        debtor_name: formData.debtor_name,
        amount_owed: parseFloat(formData.amount_owed),
        date_lent: formData.date_lent,
        expected_repayment_date: formData.expected_repayment_date || null,
        status: formData.status,
        bank: validateBankType(formData.bank) ?? null,
        payment_method: formData.payment_method || null,
        person: formData.person || null,
        description: formData.description || null,
        notes: formData.notes || null,
      });
      router.push('/debtors');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debtor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Add Debtor"
        subtitle="Track someone who owes you money"
        actions={
          <Link
            href="/debtors"
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
          </Link>
        }
      />

      <Card variant="outlined" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/50 text-red-400">
              {error}
            </div>
          )}

          {/* Debtor Name */}
          <Input
            label="Who owes you?"
            value={formData.debtor_name}
            onChange={(e) => setFormData({ ...formData, debtor_name: e.target.value })}
            placeholder="e.g., John, Mum, Company XYZ"
            required
          />

          {/* Amount */}
          <Input
            label="Amount Owed"
            type="number"
            step="0.01"
            min="0.01"
            value={formData.amount_owed}
            onChange={(e) => setFormData({ ...formData, amount_owed: e.target.value })}
            placeholder="0.00"
            required
          />

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Date Lent"
              type="date"
              value={formData.date_lent}
              onChange={(e) => setFormData({ ...formData, date_lent: e.target.value })}
              required
            />
            <Input
              label="Expected Repayment Date (optional)"
              type="date"
              value={formData.expected_repayment_date}
              onChange={(e) => setFormData({ ...formData, expected_repayment_date: e.target.value })}
            />
          </div>

          {/* Bank and Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
                Bank/Account Used
              </label>
              <select
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
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
                Person
              </label>
              <select
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">Select...</option>
                {persons.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as DebtorStatusType })}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was the money for?"
              rows={3}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text-muted)] mb-2">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Add Debtor'}
            </Button>
            <Link href="/debtors">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
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
