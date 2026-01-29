'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ExpenseService, SettingsService } from '@/lib/services';
import { filterValidPaymentMethods, DEFAULT_PAYMENT_METHODS } from '@/lib/utils/payment-methods';

interface BudgetOption {
  id: string;
  name: string;
  budget_amount: number;
  amount_left: number;
}

interface FormData {
  budget_id: string;
  amount: string;
  date: string;
  bank: string;
  description: string;
  is_recurring: boolean;
  recurring_frequency: string;
  financial_goal_id: string;
}

export default function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id: monthId, expenseId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<BudgetOption[]>([]);
  const [goals, setGoals] = useState<Array<{ id: string; name: string; target_amount: number; current_amount: number }>>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ value: string; label: string }[]>(DEFAULT_PAYMENT_METHODS);
  const [formData, setFormData] = useState<FormData>({
    budget_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    bank: 'Revolut',
    description: '',
    is_recurring: false,
    recurring_frequency: 'Monthly',
    financial_goal_id: '',
  });

  const FREQUENCY_OPTIONS = [
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Bi-Weekly', label: 'Bi-Weekly' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Quarterly', label: 'Quarterly' },
    { value: 'Bi-Annually', label: 'Bi-Annually' },
    { value: 'Annually', label: 'Annually' },
  ];

  // Fetch expense data and related data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push(`/months/${monthId}`);
          return;
        }

        const expenseService = new ExpenseService(supabase);
        const expense = await expenseService.getById(expenseId);

        // Fetch budgets
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_summary')
          .select('id, name, budget_amount, amount_left')
          .eq('monthly_overview_id', monthId)
          .order('name');

        if (!budgetError && budgetData) {
          setBudgets(budgetData);
        }

        // Fetch active goals (not completed or cancelled)
        const { data: goalData, error: goalError } = await supabase
          .from('financial_goals')
          .select('id, name, target_amount, current_amount')
          .in('status', ['Not Started', 'In Progress', 'On Hold'])
          .order('name');

        if (!goalError && goalData) {
          setGoals(goalData);
        }

        // Fetch payment methods from settings
        const settingsService = new SettingsService(supabase);
        const methods = await settingsService.getPaymentMethods();
        // Filter to only valid bank_type enum values
        const validMethods = methods.length > 0 
          ? filterValidPaymentMethods(methods)
          : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(validMethods);

        // Populate form with expense data
        setFormData({
          budget_id: expense.budget_id,
          amount: expense.amount.toString(),
          date: expense.date,
          bank: expense.bank || 'Revolut',
          description: expense.description || '',
          is_recurring: expense.is_recurring || false,
          recurring_frequency: expense.recurring_frequency || 'Monthly',
          financial_goal_id: expense.financial_goal_id || '',
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching expense:', err);
        setError(err instanceof Error ? err.message : 'Failed to load expense');
        setIsLoading(false);
      }
    }

    fetchData();
  }, [expenseId, monthId, router]);

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
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to edit expenses');
        setIsSaving(false);
        return;
      }

      const expenseService = new ExpenseService(supabase);
      const expenseAmount = parseFloat(formData.amount);
      
      await expenseService.update(expenseId, {
        budget_id: formData.budget_id,
        amount: expenseAmount,
        date: formData.date,
        bank: formData.bank || null,
        description: formData.description || null,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring ? (formData.recurring_frequency as any) : null,
        financial_goal_id: formData.financial_goal_id || null,
      });

      // Get the budget to redirect back to budget page
      const { data: budget } = await supabase
        .from('budgets')
        .select('id')
        .eq('id', formData.budget_id)
        .single();

      if (budget) {
        router.push(`/months/${monthId}/budgets/${budget.id}`);
      } else {
        router.push(`/months/${monthId}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBudget = budgets.find(b => b.id === formData.budget_id);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card variant="raised" padding="lg">
          <div className="text-center py-8">
            <p className="text-body text-[var(--color-text-muted)]">Loading expense...</p>
          </div>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-headline text-[var(--color-text)]">Edit Expense</h1>
          <p className="text-small text-[var(--color-text-muted)]">
            Update expense details
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
                  No budget categories found.
                </p>
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

          {/* Financial Goal (Optional) */}
          {goals.length > 0 && (
            <Select
              label="Link to Financial Goal (Optional)"
              name="financial_goal_id"
              value={formData.financial_goal_id}
              onChange={handleChange}
              options={[
                { value: '', label: 'No goal' },
                ...goals.map(goal => ({
                  value: goal.id,
                  label: `${goal.name} (${((goal.current_amount / goal.target_amount) * 100).toFixed(0)}% complete)`,
                })),
              ]}
              hint="Link this expense to a financial goal to track progress"
            />
          )}

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
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link
              href={selectedBudget ? `/months/${monthId}/budgets/${selectedBudget.id}` : `/months/${monthId}`}
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
              <CheckIcon className="w-5 h-5" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
