'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SettingsService } from '@/lib/services';
import { filterValidPaymentMethods, DEFAULT_PAYMENT_METHODS } from '@/lib/utils/payment-methods';
import { ExpenseSchema, type ExpenseInput } from '@/lib/validation/schemas';
import { useFormValidation } from '@/lib/hooks/useFormValidation';
import { useFormToastActions } from '@/lib/hooks/useFormToast';

interface BudgetOption {
  id: string;
  name: string;
  budget_amount: number;
  amount_left: number;
}

type RecurringFreq = NonNullable<ExpenseInput['recurring_frequency']>;

interface FormData {
  budget_id: string;
  amount: string;
  date: string;
  bank: string;
  description: string;
  is_recurring: boolean;
  recurring_frequency: RecurringFreq | '';
}

export default function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const { showSuccessToast, showErrorToast } = useFormToastActions();
  const { errors, validateField, validateAll, clearError } = useFormValidation(ExpenseSchema);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>(DEFAULT_PAYMENT_METHODS);
  const [formData, setFormData] = useState<FormData>({
    budget_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    bank: 'Revolut',
    description: '',
    is_recurring: false,
    recurring_frequency: 'Monthly',
  });

  const FREQUENCY_OPTIONS = [
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Bi-Weekly', label: 'Bi-Weekly' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Quarterly', label: 'Quarterly' },
    { value: 'Bi-Annually', label: 'Bi-Annually' },
    { value: 'Annually', label: 'Annually' },
  ];

  // Fetch budgets, goals, and payment methods on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return;
        }

        // Fetch budgets
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_summary')
          .select('id, name, budget_amount, amount_left')
          .eq('monthly_overview_id', monthId)
          .order('name');

        if (!budgetError && budgetData) {
          setBudgets(budgetData);
        }

        // Fetch payment methods from settings
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        // Filter to only valid bank_type enum values
        const validMethods = methods.length > 0 
          ? filterValidPaymentMethods(methods)
          : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(validMethods);
      } catch {
        // Silent fail - will use defaults
      }
    }

    fetchData();
  }, [monthId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));

    // Clear error when user types
    if (errors[name as keyof FormData]) {
      clearError(name as keyof FormData);
    }
  };

  const handleBlur = (name: keyof FormData) => {
    // Convert form value for validation
    let value: any = formData[name];

    // Convert amount to number for validation
    if (name === 'amount' && formData.amount) {
      value = parseFloat(formData.amount);
    }

    // Validate field on blur
    validateField(name, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Prepare data for validation (convert amount to number)
      const dataToValidate = {
        budget_id: formData.budget_id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        bank: formData.bank || null,
        description: formData.description || null,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring && formData.recurring_frequency ? formData.recurring_frequency : null,
      };

      // Validate with Zod
      const validationResult = validateAll(dataToValidate);

      if (!validationResult.valid) {
        showErrorToast('Please fix the validation errors before submitting');
        setIsLoading(false);
        return;
      }

      // Additional validation: Check overspending
      const selectedBudget = budgets.find(b => b.id === formData.budget_id);
      if (selectedBudget && parseFloat(formData.amount) > selectedBudget.amount_left) {
        const errorMessage = `This expense (€${formData.amount}) exceeds the remaining budget (€${selectedBudget.amount_left.toFixed(2)}) for ${selectedBudget.name}.`;
        setError(errorMessage);
        showErrorToast(errorMessage);
        setIsLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const errorMessage = 'You must be logged in to add expenses';
        setError(errorMessage);
        showErrorToast(errorMessage);
        setIsLoading(false);
        return;
      }

      const expenseAmount = parseFloat(formData.amount);

      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          budget_id: formData.budget_id,
          user_id: user.id,
          amount: expenseAmount,
          date: formData.date,
          bank: formData.bank || null,
          description: formData.description || null,
          is_recurring: formData.is_recurring,
          recurring_frequency: formData.is_recurring ? (formData.recurring_frequency as any) : null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      showSuccessToast('Expense added successfully');
      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add expense';
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBudget = budgets.find(b => b.id === formData.budget_id);

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
          <h1 className="text-headline text-[var(--color-text)]">Add Expense</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Record a new expense
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

          {/* Budget Category */}
          <div>
            <label className="block text-small font-medium text-[var(--color-text)] mb-1.5">
              Budget Category
            </label>
            {budgets.length === 0 ? (
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                <p className="text-small text-[var(--color-warning)]">
                  No budget categories found. Please add budgets to this month first.
                </p>
                <Link 
                  href={`/months/${monthId}`}
                  className="text-small text-[var(--color-primary)] hover:underline mt-2 inline-block"
                >
                  Go back to add budgets
                </Link>
              </div>
            ) : (
              <select
                name="budget_id"
                value={formData.budget_id}
                onChange={handleChange}
                required
                className="w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-body transition-colors duration-200 hover:border-[var(--color-border-strong)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer"
              >
                <option value="" disabled>Select a budget category</option>
                {budgets.map((budget) => (
                  <option 
                    key={budget.id} 
                    value={budget.id}
                    disabled={budget.amount_left <= 0}
                  >
                    {budget.name} (€{budget.amount_left.toFixed(0)} left)
                  </option>
                ))}
              </select>
            )}
            {selectedBudget && (
              <div className="mt-2 p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)]">
                <div className="flex justify-between items-center">
                  <span className="text-small text-[var(--color-text-muted)]">Budget</span>
                  <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                    €{selectedBudget.budget_amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-small text-[var(--color-text-muted)]">Remaining</span>
                  <span className={`text-small font-medium tabular-nums ${
                    selectedBudget.amount_left > 0 
                      ? 'text-[var(--color-success)]' 
                      : 'text-[var(--color-danger)]'
                  }`}>
                    €{selectedBudget.amount_left.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <Input
            label="Amount (€)"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={selectedBudget?.amount_left}
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            onBlur={() => handleBlur('amount')}
            error={errors.amount}
            required
            hint={selectedBudget ? `Max: €${selectedBudget.amount_left.toFixed(2)}` : undefined}
          />

          {/* Date */}
          <Input
            label="Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            onBlur={() => handleBlur('date')}
            error={errors.date}
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

          {/* Recurring */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                name="is_recurring"
                checked={formData.is_recurring}
                onChange={handleChange}
                className="w-5 h-5 rounded-[var(--radius-sm)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <div>
                <span className="text-body font-medium text-[var(--color-text)]">
                  Recurring Expense
                </span>
                <p className="text-small text-[var(--color-text-muted)]">
                  Mark this as a recurring expense
                </p>
              </div>
            </label>
            
            {formData.is_recurring && (
              <Select
                label="Recurring Frequency"
                name="recurring_frequency"
                value={formData.recurring_frequency}
                onChange={handleChange}
                options={FREQUENCY_OPTIONS}
                hint="How often should this expense be created?"
              />
            )}
          </div>

          {/* Description */}
          <Textarea
            label="Description (optional)"
            name="description"
            placeholder="Add any notes about this expense..."
            value={formData.description}
            onChange={handleChange}
            onBlur={() => handleBlur('description')}
            error={errors.description}
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
              Add Expense
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
