import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, BudgetProgress } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BudgetService, ExpenseService } from '@/lib/services';
import { BudgetActions } from './BudgetActions';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function getBudgetData(budgetId: string, monthId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const budgetService = new BudgetService(supabase);
    const expenseService = new ExpenseService(supabase);

    const budget = await budgetService.getWithSummary(budgetId);
    const expenses = await expenseService.getByBudget(budgetId);

    return { budget, expenses };
  } catch {
    return null;
  }
}

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string; budgetId: string }>;
}) {
  const { id: monthId, budgetId } = await params;
  const data = await getBudgetData(budgetId, monthId);

  if (!data) {
    notFound();
  }

  const { budget, expenses } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/months/${monthId}`}
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
          <div>
            <h1 className="text-display text-[var(--color-text)]">{budget.name}</h1>
            <p className="text-body text-[var(--color-text-muted)] mt-1">
              Budget Category
            </p>
          </div>
        </div>
        <BudgetActions budgetId={budgetId} monthId={monthId} budgetName={budget.name} />
      </div>

      {/* Budget Summary */}
      <Card variant="raised" padding="lg">
        <div className="space-y-6">
          {/* Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-small font-medium text-[var(--color-text-muted)]">
                Spending Progress
              </span>
              <span className="text-body font-medium text-[var(--color-text)] tabular-nums">
                {((budget.amount_spent / budget.budget_amount) * 100).toFixed(0)}%
              </span>
            </div>
            <BudgetProgress spent={budget.amount_spent} total={budget.budget_amount} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Budget</p>
              <p className="text-title font-medium text-[var(--color-text)] tabular-nums">
                {formatCurrency(budget.budget_amount)}
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Spent</p>
              <p className="text-title font-medium text-[var(--color-warning)] tabular-nums">
                {formatCurrency(budget.amount_spent)}
              </p>
            </div>
            <div>
              <p className="text-caption text-[var(--color-text-muted)] mb-1">Remaining</p>
              <p className={`text-title font-medium tabular-nums ${
                budget.amount_left >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              }`}>
                {formatCurrency(budget.amount_left)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Expenses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-[var(--color-text)]">Expenses</h2>
          <Link
            href={`/months/${monthId}/expense/new?budget=${budgetId}`}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Expense
          </Link>
        </div>

        {expenses.length > 0 ? (
          <Card variant="outlined" padding="none">
            <div className="divide-y divide-[var(--color-border)]">
              {expenses.map((expense) => (
                <Link
                  key={expense.id}
                  href={`/months/${monthId}/expense/${expense.id}/edit`}
                  className="block p-4 flex items-center justify-between hover:bg-[var(--color-surface-sunken)] transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-body font-medium text-[var(--color-text)]">
                      {expense.description || 'Expense'}
                    </p>
                    <p className="text-small text-[var(--color-text-muted)]">
                      {formatDate(expense.date)}
                      {expense.bank && ` · ${expense.bank}`}
                    </p>
                  </div>
                  <span className="text-body font-medium text-[var(--color-text)] tabular-nums ml-4">
                    -{formatCurrency(expense.amount)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <Card variant="outlined" padding="lg" className="text-center">
            <p className="text-body text-[var(--color-text-muted)] mb-4">
              No expenses recorded in this budget yet.
            </p>
            <Link
              href={`/months/${monthId}/expense/new?budget=${budgetId}`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add First Expense
            </Link>
          </Card>
        )}
      </div>
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
