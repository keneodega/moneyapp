'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, DeleteButton } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BudgetService, MasterBudgetService } from '@/lib/services';
import { useFormToastActions } from '@/lib/hooks/useFormToast';
import { z } from 'zod';

// Simple validation schema for budget editing
const BudgetEditSchema = z.object({
  name: z.string().min(1, 'Budget name is required').max(100, 'Name must be less than 100 characters'),
  budget_amount: z.number().nonnegative('Budget amount cannot be negative'),
  override_reason: z.string().max(500, 'Override reason must be less than 500 characters').optional(),
});

export default function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string; budgetId: string }>;
}) {
  const { id: monthId, budgetId } = use(params);
  const router = useRouter();
  const { showSuccessToast, showErrorToast } = useFormToastActions();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    budget_amount: '',
    override_reason: '',
  });
  const [masterBudgetAmount, setMasterBudgetAmount] = useState<number | null>(null);
  const [masterBudgetName, setMasterBudgetName] = useState<string | null>(null);

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

        // Load master budget if linked
        if (budget.master_budget_id) {
          const masterBudgetService = new MasterBudgetService(supabase);
          try {
            const masterBudget = await masterBudgetService.getById(budget.master_budget_id);
            setMasterBudgetAmount(masterBudget.budget_amount);
            setMasterBudgetName(masterBudget.name);
          } catch (err) {
            console.warn('Could not load master budget:', err);
          }
        }

        setFormData({
          name: budget.name,
          budget_amount: budget.budget_amount.toString(),
          override_reason: budget.override_reason || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load budget');
      } finally {
        setIsLoading(false);
      }
    }

    loadBudget();
  }, [budgetId, monthId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field error when user types
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleBlur = (name: keyof typeof formData) => {
    try {
      const fieldSchema = (BudgetEditSchema as any).shape[name];
      let value: any = formData[name];

      // Convert budget_amount to number for validation
      if (name === 'budget_amount') {
        value = parseFloat(formData.budget_amount) || 0;
      }

      if (fieldSchema) {
        fieldSchema.parse(value);
        // Clear error if validation passes
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFieldErrors(prev => ({
          ...prev,
          [name]: error.issues[0]?.message || 'Invalid value',
        }));
      }
    }
  };

  // Calculate if this is an override
  const newAmount = parseFloat(formData.budget_amount) || 0;
  const isOverride = masterBudgetAmount !== null && Math.abs(newAmount - masterBudgetAmount) > 0.01;
  const deviation = masterBudgetAmount !== null ? newAmount - masterBudgetAmount : null;
  const deviationPercentValue = masterBudgetAmount !== null && masterBudgetAmount > 0
    ? (deviation! / masterBudgetAmount) * 100
    : null;
  const deviationPercent = deviationPercentValue !== null ? deviationPercentValue.toFixed(1) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const newAmount = parseFloat(formData.budget_amount) || 0;
      const isOverride = masterBudgetAmount !== null && Math.abs(newAmount - masterBudgetAmount) > 0.01;

      // Prepare data for validation
      const dataToValidate = {
        name: formData.name,
        budget_amount: newAmount,
        override_reason: formData.override_reason,
      };

      // Validate with Zod
      const validationResult = BudgetEditSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        const errors: Record<string, string> = {};
        validationResult.error.issues.forEach(err => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFieldErrors(errors);
        showErrorToast('Please fix the validation errors before submitting');
        setIsSaving(false);
        return;
      }

      // Additional validation: Require reason if overriding master budget
      if (isOverride && !formData.override_reason.trim()) {
        const errorMessage = 'Please provide a reason for changing this budget amount from the master budget.';
        setFieldErrors({ override_reason: errorMessage });
        setError(errorMessage);
        showErrorToast(errorMessage);
        setIsSaving(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const errorMessage = 'You must be logged in';
        setError(errorMessage);
        showErrorToast(errorMessage);
        setIsSaving(false);
        return;
      }

      const budgetService = new BudgetService(supabase);

      await budgetService.update(budgetId, {
        name: formData.name.trim(),
        budget_amount: newAmount,
        override_amount: isOverride ? newAmount : null,
        override_reason: isOverride ? formData.override_reason.trim() : null,
      });

      showSuccessToast('Budget updated successfully');
      router.push(`/months/${monthId}/budgets/${budgetId}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update budget';
      setError(errorMessage);
      showErrorToast(errorMessage);
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
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
        </button>
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
            onBlur={() => handleBlur('name')}
            error={fieldErrors.name}
            required
          />

          {/* Master Budget Info */}
          {masterBudgetAmount !== null && (
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)]">
              <p className="text-small text-[var(--color-text-muted)] mb-1">Master Budget</p>
              <p className="text-body font-medium text-[var(--color-text)]">
                {masterBudgetName}: €{masterBudgetAmount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
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
            onBlur={() => handleBlur('budget_amount')}
            error={fieldErrors.budget_amount}
            required
            hint={
              masterBudgetAmount !== null
                ? `Master budget: €${masterBudgetAmount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "You can increase or decrease this at any time"
            }
          />

          {/* Deviation Display */}
          {deviation !== null && Math.abs(deviation) > 0.01 && (
            <div className={`p-4 rounded-[var(--radius-md)] ${
              deviation > 0 
                ? 'bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20' 
                : 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/20'
            }`}>
              <p className="text-small font-medium text-[var(--color-text)]">
                {deviation > 0 ? '↑' : '↓'} Deviation from Master: 
                <span className={deviation > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
                  {' '}{deviation > 0 ? '+' : ''}€{deviation.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {deviationPercent && ` (${deviationPercentValue! > 0 ? '+' : ''}${deviationPercent}%)`}
                </span>
              </p>
            </div>
          )}

          {/* Override Reason (required if override) */}
          {isOverride && (
            <div>
              <label className="block text-small font-medium text-[var(--color-text)] mb-2">
                Reason for Override <span className="text-[var(--color-danger)]">*</span>
              </label>
              <textarea
                name="override_reason"
                value={formData.override_reason}
                onChange={handleChange}
                onBlur={() => handleBlur('override_reason')}
                placeholder="e.g., Special event this month, Holiday season, Unexpected expenses..."
                required
                rows={3}
                className={`w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border ${
                  fieldErrors.override_reason
                    ? 'border-[var(--color-danger)]'
                    : 'border-[var(--color-border)]'
                } text-body text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent`}
              />
              {fieldErrors.override_reason && (
                <p className="text-small text-[var(--color-danger)] mt-1">
                  {fieldErrors.override_reason}
                </p>
              )}
              {!fieldErrors.override_reason && (
                <p className="text-small text-[var(--color-text-muted)] mt-1">
                  Explain why this month's budget differs from the master budget. This helps with reporting and analysis.
                </p>
              )}
            </div>
          )}

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
