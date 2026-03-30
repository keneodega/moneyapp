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

const TITHE_RATE = 0.10;
const OFFERING_RATE = 0.05;

interface FormData {
  amount: string;
  source: string;
  person: string;
  bank: string;
  date_paid: string;
  description: string;
  auto_tithe: boolean;
  auto_offering: boolean;
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
  const [originalIncome, setOriginalIncome] = useState<{ amount: number; tithe_deduction: boolean } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    source: 'Salary',
    person: '',
    bank: '',
    date_paid: new Date().toISOString().split('T')[0],
    description: '',
    auto_tithe: false,
    auto_offering: false,
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

        // Remember original values for delta calculation
        setOriginalIncome({
          amount: existingIncome.amount,
          tithe_deduction: existingIncome.tithe_deduction,
        });

        // Set form data from existing income
        setFormData({
          amount: String(existingIncome.amount),
          source: existingIncome.source || 'Salary',
          person: existingIncome.person || '',
          bank: existingIncome.bank || banksToUse[0]?.value || '',
          date_paid: existingIncome.date_paid || new Date().toISOString().split('T')[0],
          description: existingIncome.description || '',
          auto_tithe: existingIncome.tithe_deduction,
          // Offering is assumed to follow tithe (per existing create/delete logic)
          auto_offering: existingIncome.tithe_deduction,
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

  const calculations = useMemo(() => {
    const amount = parseFloat(formData.amount) || 0;
    const titheAmount = formData.auto_tithe ? amount * TITHE_RATE : 0;
    const offeringAmount = formData.auto_offering ? amount * OFFERING_RATE : 0;
    return { amount, titheAmount, offeringAmount, totalGiving: titheAmount + offeringAmount };
  }, [formData.amount, formData.auto_tithe, formData.auto_offering]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
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
      await incomeService.updateWithGiving(
        incomeId,
        {
          amount: parseFloat(formData.amount),
          source: sourceValue as any,
          person: formData.person || null,
          bank: validateBankType(formData.bank) ?? null,
          date_paid: formData.date_paid,
          description: formData.description || null,
        },
        {
          oldAmount: originalIncome?.amount ?? parseFloat(formData.amount),
          wasOldTithe: originalIncome?.tithe_deduction ?? false,
          newTithe: formData.auto_tithe,
          newOffering: formData.auto_offering,
        },
      );

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

          {/* Tithe & Offering Section */}
          <div className="space-y-4">
            <h3 className="text-body font-medium text-[var(--color-text)]">Giving</h3>

            {/* Tithe Checkbox */}
            <label className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors">
              <input
                type="checkbox"
                name="auto_tithe"
                checked={formData.auto_tithe}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded-[var(--radius-sm)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium text-[var(--color-text)]">Tithe</span>
                  <span className="text-small font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full">
                    10%
                  </span>
                </div>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Giving back to God - 10% of all income
                </p>
                {formData.auto_tithe && calculations.amount > 0 && (
                  <p className="text-body font-semibold text-[var(--color-success)] mt-2">
                    {formatCurrency(calculations.titheAmount)}
                  </p>
                )}
              </div>
            </label>

            {/* Offering Checkbox */}
            <label className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-accent)]/50 transition-colors">
              <input
                type="checkbox"
                name="auto_offering"
                checked={formData.auto_offering}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded-[var(--radius-sm)] border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium text-[var(--color-text)]">Offering</span>
                  <span className="text-small font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-full">
                    5%
                  </span>
                </div>
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Additional giving - 5% of income
                </p>
                {formData.auto_offering && calculations.amount > 0 && (
                  <p className="text-body font-semibold text-[var(--color-success)] mt-2">
                    {formatCurrency(calculations.offeringAmount)}
                  </p>
                )}
              </div>
            </label>
          </div>

          {/* Calculation Summary */}
          {calculations.amount > 0 && (formData.auto_tithe || formData.auto_offering) && (
            <Card variant="outlined" padding="md" className="bg-gradient-warm">
              <h4 className="text-small font-medium text-[var(--color-text-muted)] mb-3">Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-body text-[var(--color-text)]">Gross Income</span>
                  <span className="text-body font-medium text-[var(--color-text)] tabular-nums">
                    {formatCurrency(calculations.amount)}
                  </span>
                </div>
                {formData.auto_tithe && (
                  <div className="flex justify-between items-center">
                    <span className="text-body text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <MinusIcon className="w-3 h-3" />
                        Tithe (10%)
                      </span>
                    </span>
                    <span className="text-body text-[var(--color-primary)] tabular-nums">
                      -{formatCurrency(calculations.titheAmount)}
                    </span>
                  </div>
                )}
                {formData.auto_offering && (
                  <div className="flex justify-between items-center">
                    <span className="text-body text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <MinusIcon className="w-3 h-3" />
                        Offering (5%)
                      </span>
                    </span>
                    <span className="text-body text-[var(--color-accent)] tabular-nums">
                      -{formatCurrency(calculations.offeringAmount)}
                    </span>
                  </div>
                )}
                <div className="border-t border-[var(--color-border)] pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-body font-medium text-[var(--color-text)]">Total Giving</span>
                    <span className="text-body font-semibold text-[var(--color-success)] tabular-nums">
                      {formatCurrency(calculations.totalGiving)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-body font-medium text-[var(--color-text)]">Net Income</span>
                    <span className="text-body font-semibold text-[var(--color-text)] tabular-nums">
                      {formatCurrency(calculations.amount - calculations.totalGiving)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

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

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  );
}
