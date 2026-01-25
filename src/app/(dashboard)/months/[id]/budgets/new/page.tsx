'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService } from '@/lib/services';

const BUDGET_CATEGORIES = [
  'Tithe',
  'Offering',
  'Charity',
  'Housing',
  'Food',
  'Transport',
  'Personal Care',
  'Household',
  'Savings',
  'Investments',
  'Subscriptions',
  'Health',
  'Travel',
  'Entertainment',
  'Education',
  'Childcare',
  'Pet',
  'Insurance',
  'Miscellaneous',
  'Custom',
];

export default function NewBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    customName: '',
    budget_amount: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
        setError('You must be logged in');
        setIsLoading(false);
        return;
      }

      const budgetService = new BudgetService(supabase);
      const budgetName = formData.name === 'Custom' ? formData.customName : formData.name;

      if (!budgetName.trim()) {
        setError('Please enter a budget name');
        setIsLoading(false);
        return;
      }

      await budgetService.create({
        monthly_overview_id: monthId,
        name: budgetName.trim(),
        budget_amount: parseFloat(formData.budget_amount) || 0,
      });

      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-headline text-[var(--color-text)]">Add Budget Category</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Create a new budget category for this month
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

          {/* Category Name */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
              Category
            </label>
            <select
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body transition-colors duration-200 hover:border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer"
            >
              <option value="" disabled>Select a category</option>
              {BUDGET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Custom Name (if Custom selected) */}
          {formData.name === 'Custom' && (
            <Input
              label="Custom Category Name"
              name="customName"
              placeholder="e.g., Baby Expenses"
              value={formData.customName}
              onChange={handleChange}
              required
            />
          )}

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
            hint="How much do you want to allocate to this category?"
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
              className="flex-1"
            >
              <PlusIcon className="w-5 h-5" />
              Add Budget
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
