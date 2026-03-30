'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoalContributionService, SettingsService } from '@/lib/services';
import { ValidationError, NotFoundError } from '@/lib/services/errors';
import { DEFAULT_PAYMENT_METHODS, validateBankType } from '@/lib/utils/payment-methods';

export default function EditContributionPage({
  params,
}: {
  params: Promise<{ id: string; contributionId: string }>;
}) {
  const router = useRouter();
  const [goalId, setGoalId] = useState<string | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>([]);
  const [goalName, setGoalName] = useState('');
  const [formData, setFormData] = useState({
    amount: '',
    date: '',
    description: '',
    bank: '',
    notes: '',
  });

  useEffect(() => {
    async function loadContribution() {
      const resolvedParams = await params;
      const gId = resolvedParams.id;
      const cId = resolvedParams.contributionId;
      setGoalId(gId);
      setContributionId(cId);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/goals');
          return;
        }

        // Load payment methods
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        const userMethods = methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(userMethods);

        // Load goal name
        const { data: goal } = await supabase
          .from('financial_goals')
          .select('name')
          .eq('id', gId)
          .single();

        if (goal) {
          setGoalName(goal.name);
        }

        // Load contribution
        const { data: contribution, error: fetchError } = await supabase
          .from('goal_contributions')
          .select('*')
          .eq('id', cId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !contribution) {
          setError('Contribution not found');
          setIsLoading(false);
          return;
        }

        setFormData({
          amount: Number(contribution.amount).toFixed(2),
          date: contribution.date,
          description: contribution.description || '',
          bank: contribution.bank || '',
          notes: contribution.notes || '',
        });
      } catch (err) {
        if (err instanceof NotFoundError) {
          setError('Contribution not found');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load contribution');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadContribution();
  }, [params, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionId) return;

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const contributionService = new GoalContributionService(supabase);

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('Amount must be greater than zero');
        setIsSaving(false);
        return;
      }

      await contributionService.update(contributionId, {
        amount,
        date: formData.date,
        description: formData.description || null,
        bank: validateBankType(formData.bank) as any,
        notes: formData.notes || null,
      });

      router.push(`/goals/${goalId}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update contribution');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading contribution...</p>
        </Card>
      </div>
    );
  }

  if (error && !contributionId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card variant="outlined" padding="lg" className="text-center">
          <h2 className="text-headline text-[var(--color-text)] mb-2">Error</h2>
          <p className="text-body text-[var(--color-text-muted)] mb-6">{error}</p>
          <Link
            href={goalId ? `/goals/${goalId}` : '/goals'}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Back to Savings
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Edit Contribution"
        subtitle={goalName ? `Contribution to ${goalName}` : undefined}
        actions={
          <Link
            href={goalId ? `/goals/${goalId}` : '/goals'}
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
        }
      />

      <Card variant="raised" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
              <p className="text-small text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Amount */}
          <Input
            label="Amount"
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
            options={paymentMethods}
          />

          {/* Description */}
          <Input
            label="Description (Optional)"
            name="description"
            type="text"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional description"
          />

          {/* Notes */}
          <Textarea
            label="Notes (Optional)"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Optional notes"
            rows={3}
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href={goalId ? `/goals/${goalId}` : '/goals'}
              className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              size="lg"
              isLoading={isSaving}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>
        </form>
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
