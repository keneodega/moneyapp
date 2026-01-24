'use client';

import { useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const INCOME_SOURCES = [
  { value: 'Salary', label: 'Salary' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Side Hustle', label: 'Side Hustle' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Refund', label: 'Refund' },
  { value: 'Other', label: 'Other' },
];

const PERSONS = [
  { value: 'Kene', label: 'Kene' },
  { value: 'Ify', label: 'Ify' },
  { value: 'Joint', label: 'Joint' },
  { value: 'Other', label: 'Other' },
];

const BANKS = [
  { value: 'AIB', label: 'AIB' },
  { value: 'Revolut', label: 'Revolut' },
  { value: 'N26', label: 'N26' },
  { value: 'Wise', label: 'Wise' },
  { value: 'Bank of Ireland', label: 'Bank of Ireland' },
  { value: 'Ulster Bank', label: 'Ulster Bank' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];

// Percentage rates
const TITHE_RATE = 0.10; // 10%
const OFFERING_RATE = 0.05; // 5%

interface FormData {
  amount: string;
  source: string;
  person: string;
  bank: string;
  date_paid: string;
  auto_tithe: boolean;
  auto_offering: boolean;
  description: string;
}

export default function NewIncomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    source: 'Salary',
    person: 'Kene',
    bank: 'AIB',
    date_paid: new Date().toISOString().split('T')[0],
    auto_tithe: true,
    auto_offering: true,
    description: '',
  });

  // Calculate tithe and offering amounts
  const calculations = useMemo(() => {
    const amount = parseFloat(formData.amount) || 0;
    const titheAmount = formData.auto_tithe ? amount * TITHE_RATE : 0;
    const offeringAmount = formData.auto_offering ? amount * OFFERING_RATE : 0;
    const totalGiving = titheAmount + offeringAmount;
    const netIncome = amount - totalGiving;

    return {
      amount,
      titheAmount,
      offeringAmount,
      totalGiving,
      netIncome,
    };
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

      if ( !user) {
        // For demo purposes, just redirect back
        router.push(`/months/${monthId}`);
        return;
      }

      // 1. Insert the income source
      const { error: insertError } = await supabase
        .from('income_sources')
        .insert({
          monthly_overview_id: monthId,
          user_id: user.id,
          amount: calculations.amount,
          source: formData.source,
          person: formData.person,
          bank: formData.bank,
          date_paid: formData.date_paid,
          tithe_deduction: formData.auto_tithe || formData.auto_offering,
          description: formData.description || null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      // 2. If auto-tithe is enabled, create expense in Tithe budget
      if (formData.auto_tithe && calculations.titheAmount > 0) {
        // Find the Tithe budget for this month
        const { data: titheBudget } = await supabase
          .from('budgets')
          .select('id')
          .eq('monthly_overview_id', monthId)
          .eq('name', 'Tithe')
          .single();

        if (titheBudget) {
          await supabase.from('expenses').insert({
            budget_id: titheBudget.id,
            user_id: user.id,
            amount: calculations.titheAmount,
            date: formData.date_paid,
            description: `Tithe (10%) from ${formData.source} - ${formData.person}`,
            sub_category: 'Tithe',
            bank: formData.bank,
          });
        }
      }

      // 3. If auto-offering is enabled, create expense in Offering budget
      if (formData.auto_offering && calculations.offeringAmount > 0) {
        // Find the Offering budget for this month
        const { data: offeringBudget } = await supabase
          .from('budgets')
          .select('id')
          .eq('monthly_overview_id', monthId)
          .eq('name', 'Offering')
          .single();

        if (offeringBudget) {
          await supabase.from('expenses').insert({
            budget_id: offeringBudget.id,
            user_id: user.id,
            amount: calculations.offeringAmount,
            date: formData.date_paid,
            description: `Offering (5%) from ${formData.source} - ${formData.person}`,
            sub_category: 'Offering',
            bank: formData.bank,
          });
        }
      }

      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add income');
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/months/${monthId}`}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Add Income</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Record a new income source
          </p>
        </div>
      </div>

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
              options={INCOME_SOURCES}
              required
            />
            <Select
              label="Person"
              name="person"
              value={formData.person}
              onChange={handleChange}
              options={PERSONS}
              required
            />
          </div>

          {/* Bank & Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Bank"
              name="bank"
              value={formData.bank}
              onChange={handleChange}
              options={BANKS}
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
            <h3 className="text-body font-medium text-[var(--color-text)]">
              Giving
            </h3>
            
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
                  <span className="text-body font-medium text-[var(--color-text)]">
                    Tithe
                  </span>
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
                  <span className="text-body font-medium text-[var(--color-text)]">
                    Offering
                  </span>
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
              <h4 className="text-small font-medium text-[var(--color-text-muted)] mb-3">
                Summary
              </h4>
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
                    <span className="text-body font-medium text-[var(--color-text)]">
                      Total Giving
                    </span>
                    <span className="text-body font-semibold text-[var(--color-success)] tabular-nums">
                      {formatCurrency(calculations.totalGiving)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-body font-medium text-[var(--color-text)]">
                      Net Income
                    </span>
                    <span className="text-body font-semibold text-[var(--color-text)] tabular-nums">
                      {formatCurrency(calculations.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Info Note */}
          {(formData.auto_tithe || formData.auto_offering) && calculations.amount > 0 && (
            <div className="flex gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10">
              <InfoIcon className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-small text-[var(--color-text-muted)]">
                {formData.auto_tithe && formData.auto_offering && (
                  <>Expenses of <strong>{formatCurrency(calculations.titheAmount)}</strong> and <strong>{formatCurrency(calculations.offeringAmount)}</strong> will be automatically added to your Tithe and Offering budgets.</>
                )}
                {formData.auto_tithe && !formData.auto_offering && (
                  <>An expense of <strong>{formatCurrency(calculations.titheAmount)}</strong> will be automatically added to your Tithe budget.</>
                )}
                {!formData.auto_tithe && formData.auto_offering && (
                  <>An expense of <strong>{formatCurrency(calculations.offeringAmount)}</strong> will be automatically added to your Offering budget.</>
                )}
              </p>
            </div>
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
            <Link
              href={`/months/${monthId}`}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)]"
            >
              <PlusIcon className="w-5 h-5" />
              Add Income
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}
