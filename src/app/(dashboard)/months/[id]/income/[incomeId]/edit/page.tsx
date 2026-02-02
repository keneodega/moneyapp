'use client';

import { useState, useMemo, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SettingsService, IncomeSourceService } from '@/lib/services';
import { DEFAULT_PAYMENT_METHODS, validateBankType } from '@/lib/utils/payment-methods';

// Default fallbacks when no settings
const DEFAULT_INCOME_SOURCES = [
  { value: 'Salary', label: 'Salary' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Side Hustle', label: 'Side Hustle' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Refund', label: 'Refund' },
  { value: 'Other', label: 'Other' },
];

const VALID_INCOME_SOURCE_TYPES = ['Salary', 'Freelance', 'Side Hustle', 'Investment', 'Gift', 'Refund', 'Other'] as const;

// Default fallbacks
const DEFAULT_PERSONS = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

const DEFAULT_BANKS = DEFAULT_PAYMENT_METHODS;

interface FormData {
  amount: string;
  source: string;
  person: string;
  bank: string;
  date_paid: string;
  description: string;
}

export default function EditIncomePage({
  params,
}: {
  params: Promise<{ id: string; incomeId: string }>;
}) {
  const { id: monthId, incomeId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persons, setPersons] = useState(DEFAULT_PERSONS);
  const [banks, setBanks] = useState(DEFAULT_BANKS);
  const [incomeSources, setIncomeSources] = useState<{ value: string; label: string }[]>(DEFAULT_INCOME_SOURCES);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    source: 'Salary',
    person: '',
    bank: '',
    date_paid: new Date().toISOString().split('T')[0],
    description: '',
  });

  // Load existing income and settings
  useEffect(() => {
    async function loadData() {
      setIsFetching(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const settingsService = new SettingsService(supabase);
        const incomeService = new IncomeSourceService(supabase);

        // Load settings and income in parallel
        const [loadedPersons, loadedBanks, loadedIncomeSources, existingIncome] = await Promise.all([
          settingsService.getPeople(),
          settingsService.getPaymentMethods(),
          settingsService.getIncomeSources(),
          incomeService.getById(incomeId),
        ]);

        if (loadedPersons.length > 0) {
          setPersons(loadedPersons);
        }

        const banksToUse = loadedBanks.length > 0 ? loadedBanks : DEFAULT_BANKS;
        setBanks(banksToUse);

        if (loadedIncomeSources.length > 0) {
          setIncomeSources(loadedIncomeSources);
        }

        // Set form data from existing income
        setFormData({
          amount: String(existingIncome.amount),
          source: existingIncome.source || 'Salary',
          person: existingIncome.person || '',
          bank: existingIncome.bank || banksToUse[0]?.value || '',
          date_paid: existingIncome.date_paid || new Date().toISOString().split('T')[0],
          description: existingIncome.description || '',
        });
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load income data. Please try again.');
      } finally {
        setIsFetching(false);
      }
    }

    loadData();
  }, [incomeId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/months/${monthId}`);
        return;
      }

      // Map source to valid IncomeSourceType (DB enum); unknown values use 'Other'
      const sourceValue = VALID_INCOME_SOURCE_TYPES.includes(formData.source as any)
        ? formData.source
        : 'Other';

      const incomeService = new IncomeSourceService(supabase);
      await incomeService.update(incomeId, {
        amount: parseFloat(formData.amount),
        source: sourceValue as any,
        person: formData.person || null,
        bank: validateBankType(formData.bank) ?? null,
        date_paid: formData.date_paid,
        description: formData.description || null,
      });

      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update income');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (isFetching) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]" />
          <div>
            <div className="h-6 w-32 bg-[var(--color-surface-sunken)] rounded" />
            <div className="h-4 w-48 bg-[var(--color-surface-sunken)] rounded mt-2" />
          </div>
        </div>
        <Card variant="raised" padding="lg">
          <div className="space-y-6">
            <div className="h-12 bg-[var(--color-surface-sunken)] rounded" />
            <div className="h-12 bg-[var(--color-surface-sunken)] rounded" />
            <div className="h-12 bg-[var(--color-surface-sunken)] rounded" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Edit Income"
        subtitle="Update income details"
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

      {/* Form */}
      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

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

          {/* Source & Person */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Income Source"
              name="source"
              value={formData.source}
              onChange={handleChange}
              options={incomeSources}
              required
            />
            <Select
              label="Person"
              name="person"
              value={formData.person}
              onChange={handleChange}
              options={persons}
              required
            />
          </div>

          {/* Bank & Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Payment Method"
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              options={banks}
            />
            <Input
              label="Date Received"
              name="date_paid"
              type="date"
              value={formData.date_paid}
              onChange={handleChange}
              required
            />
          </div>

          {/* Note about Tithe/Offering */}
          <div className="flex gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/10">
            <InfoIcon className="w-5 h-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <p className="text-small text-[var(--color-text-muted)]">
              Note: Editing the amount will not automatically adjust Tithe/Offering budgets.
              If needed, please update those budgets manually.
            </p>
          </div>

          {/* Description */}
          <Textarea
            label="Description (optional)"
            name="description"
            placeholder="Add any notes about this income..."
            value={formData.description}
            onChange={handleChange}
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
              isLoading={isLoading}
              className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
            >
              <SaveIcon className="w-5 h-5" />
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}
