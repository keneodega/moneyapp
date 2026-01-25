'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, DeleteButton } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService } from '@/lib/services';

export default function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string; budgetId: string }>;
}) {
  const { id: monthId, budgetId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    budget_amount: '',
  });

  useEffect(() => {
    async function loadBudget() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/months/${monthId}`);
          return;
        }

        const budgetService = new BudgetService(supabase);
        const budget = await budgetService.getById(budgetId);

        setFormData({
          name: budget.name,
          budget_amount: budget.budget_amount.toString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load budget');
      } finally {
        setIsLoading(false);
      }
    }

    loadBudget();
  }, [budgetId, monthId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in');
        setIsSaving(false);
        return;
      }

      const budgetService = new BudgetService(supabase);

      await budgetService.update(budgetId, {
        name: formData.name.trim(),
        budget_amount: parseFloat(formData.budget_amount) || 0,
      });

      router.push(`/months/${monthId}/budgets/${budgetId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const supabase = createSupabaseBrowserClient();
    const budgetService = new BudgetService(supabase);
    await budgetService.delete(budgetId);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card variant="outlined" padding="lg" className="text-center">
          <p className="text-body text-[var(--color-text-muted)]">Loading budget...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/months/${monthId}/budgets/${budgetId}`}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
        <div>
          <h1 className="text-headline text-[var(--color-text)]">Edit Budget</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Update budget name or amount
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

          {/* Budget Name */}
          <Input
            label="Budget Name"
            name="name"
            placeholder="e.g., Food, Transport, Entertainment"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Budget Amount */}
          <Input
            label="Budget Amount (€)"
            name="budget_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.budget_amount}
            onChange={handleChange}
            required
            hint="You can increase or decrease this at any time"
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href={`/months/${monthId}/budgets/${budgetId}`}
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

      {/* Danger Zone */}
      <Card variant="outlined" padding="lg">
        <h3 className="text-title text-[var(--color-text)] mb-2">Danger Zone</h3>
        <p className="text-small text-[var(--color-text-muted)] mb-4">
          Deleting this budget will also delete all expenses associated with it. This action cannot be undone.
        </p>
        <DeleteButton 
          onDelete={handleDelete}
          itemName={formData.name}
          redirectTo={`/months/${monthId}`}
        />
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
