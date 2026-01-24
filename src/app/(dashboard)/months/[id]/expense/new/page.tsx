'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const SUB_CATEGORIES = [
  { value: 'Rent', label: 'Rent' },
  { value: 'Electricity', label: 'Electricity' },
  { value: 'Gas', label: 'Gas' },
  { value: 'Water', label: 'Water' },
  { value: 'Internet', label: 'Internet' },
  { value: 'Phone', label: 'Phone' },
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Dining Out', label: 'Dining Out' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Fuel', label: 'Fuel' },
  { value: 'Parking', label: 'Parking' },
  { value: 'Toll', label: 'Toll' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Pharmacy', label: 'Pharmacy' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Personal Care', label: 'Personal Care' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Subscriptions', label: 'Subscriptions' },
  { value: 'Gifts', label: 'Gifts' },
  { value: 'Tithe', label: 'Tithe' },
  { value: 'Offering', label: 'Offering' },
  { value: 'Charity', label: 'Charity' },
  { value: 'Education', label: 'Education' },
  { value: 'Childcare', label: 'Childcare' },
  { value: 'Pet', label: 'Pet' },
  { value: 'Home Maintenance', label: 'Home Maintenance' },
  { value: 'Furniture', label: 'Furniture' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Vacation', label: 'Vacation' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Savings', label: 'Savings' },
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
  sub_category: string;
  bank: string;
  description: string;
  is_recurring: boolean;
  financial_goal_id: string;
}

// Mock budgets for development
const MOCK_BUDGETS: BudgetOption[] = [
  { id: '1', name: 'Tithe', budget_amount: 350, amount_left: 0 },
  { id: '2', name: 'Offering', budget_amount: 175, amount_left: 0 },
  { id: '3', name: 'Housing', budget_amount: 2228, amount_left: 0 },
  { id: '4', name: 'Food', budget_amount: 350, amount_left: 65 },
  { id: '5', name: 'Transport', budget_amount: 200, amount_left: 80 },
  { id: '6', name: 'Personal Care', budget_amount: 480, amount_left: 230 },
  { id: '7', name: 'Household', budget_amount: 130, amount_left: 85 },
  { id: '8', name: 'Savings', budget_amount: 300, amount_left: 0 },
  { id: '9', name: 'Investments', budget_amount: 100, amount_left: 0 },
  { id: '10', name: 'Subscriptions', budget_amount: 75, amount_left: 0 },
  { id: '11', name: 'Health', budget_amount: 50, amount_left: 35 },
  { id: '12', name: 'Travel', budget_amount: 50, amount_left: 50 },
  { id: '13', name: 'Miscellaneous', budget_amount: 100, amount_left: 68 },
];

export default function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monthId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<BudgetOption[]>(MOCK_BUDGETS);
  const [goals, setGoals] = useState<Array<{ id: string; name: string; target_amount: number; current_amount: number }>>([]);
  const [formData, setFormData] = useState<FormData>({
    budget_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    sub_category: '',
    bank: 'Revolut',
    description: '',
    is_recurring: false,
    financial_goal_id: '',
  });

  // Fetch budgets and goals on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if ( !user) {
          setBudgets(MOCK_BUDGETS);
          return;
        }

        // Fetch budgets
        const { data: budgetData, error: budgetError } = await supabase
          .from('budget_summary')
          .select('id, name, budget_amount, amount_left')
          .eq('monthly_overview_id', monthId)
          .order('name');

        if (budgetError || !budgetData) {
          setBudgets(MOCK_BUDGETS);
        } else {
          setBudgets(budgetData);
        }

        // Fetch active goals (not completed or cancelled)
        const { data: goalData, error: goalError } = await supabase
          .from('financial_goals')
          .select('id, name, target_amount, current_amount')
          .in('status', ['Not Started', 'In Progress', 'On Hold'])
          .order('name');

        if ( !goalError && goalData) {
          setGoals(goalData);
        }
      } catch {
        setBudgets(MOCK_BUDGETS);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate amount against budget
    const selectedBudget = budgets.find(b => b.id === formData.budget_id);
    if (selectedBudget && parseFloat(formData.amount) > selectedBudget.amount_left) {
      setError(`This expense (€${formData.amount}) exceeds the remaining budget (€${selectedBudget.amount_left.toFixed(2)}) for ${selectedBudget.name}.`);
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if ( !user) {
        // For demo purposes, just redirect back
        router.push(`/months/${monthId}`);
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
          sub_category: formData.sub_category || null,
          bank: formData.bank || null,
          description: formData.description || null,
          is_recurring: formData.is_recurring,
          financial_goal_id: formData.financial_goal_id || null,
        });

      // If expense is linked to a goal, update the goal's current_amount
      if ( !insertError && formData.financial_goal_id) {
        const { data: goal } = await supabase
          .from('financial_goals')
          .select('current_amount')
          .eq('id', formData.financial_goal_id)
          .single();

        if (goal) {
          await supabase
            .from('financial_goals')
            .update({ current_amount: (goal.current_amount || 0) + expenseAmount })
            .eq('id', formData.financial_goal_id);
        }
      }

      if (insertError) {
        throw new Error(insertError.message);
      }

      router.push(`/months/${monthId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
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
            required
            hint={selectedBudget ? `Max: €${selectedBudget.amount_left.toFixed(2)}` : undefined}
          />

          {/* Date & Sub-category */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
            <Select
              label="Sub-category (optional)"
              name="sub_category"
              value={formData.sub_category}
              onChange={handleChange}
              options={SUB_CATEGORIES}
              placeholder="Select sub-category"
            />
          </div>

          {/* Bank */}
          <Select
            label="Payment Method"
            name="bank"
            value={formData.bank}
            onChange={handleChange}
            options={BANKS}
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
          <label className="flex items-center gap-3 cursor-pointer">
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
                Mark this as a recurring monthly expense
              </p>
            </div>
          </label>

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
