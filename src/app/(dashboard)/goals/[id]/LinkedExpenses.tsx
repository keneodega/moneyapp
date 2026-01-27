import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function getLinkedExpenses(goalId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if ( !user) {
      return [];
    }

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        id,
        amount,
        date,
        description,
        budget_id,
        budgets(
          name,
          monthly_overview_id,
          monthly_overviews(id, name)
        )
      `)
      .eq('financial_goal_id', goalId)
      .order('date', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching linked expenses:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}

export async function LinkedExpenses({ goalId }: { goalId: string }) {
  const expenses = await getLinkedExpenses(goalId);

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-body text-[var(--color-text-muted)] mb-4">
          No expenses linked to this goal yet.
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Link expenses when creating them to track progress automatically.
        </p>
      </div>
    );
  }

  const totalLinked = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
        <div className="flex justify-between items-center">
          <span className="text-small text-[var(--color-text-muted)]">Total from Expenses</span>
          <span className="text-body font-medium text-[var(--color-primary)] tabular-nums">
            {formatCurrency(totalLinked)}
          </span>
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-2">
        {expenses.map((expense: any) => {
          const budget = expense.budgets as any;
          const monthlyOverview = budget?.monthly_overviews as any;
          const monthId = budget?.monthly_overview_id || monthlyOverview?.id || '';
          const budgetId = expense.budget_id || '';
          const budgetName = budget?.name || 'Unknown';
          
          // Link to budget detail page: /months/{monthId}/budgets/{budgetId}
          // This will take the user directly to the budget category where the expense is located
          const budgetDetailUrl = (monthId && budgetId) 
            ? `/months/${monthId}/budgets/${budgetId}`
            : monthId 
            ? `/months/${monthId}` 
            : '#';
          
          return (
            <Link
              key={expense.id}
              href={budgetDetailUrl}
              className="block p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="text-body font-medium text-[var(--color-text)]">
                    {expense.description || 'Expense'}
                  </p>
                  <p className="text-small text-[var(--color-text-muted)]">
                    {budgetName} • {formatDate(expense.date)}
                  </p>
                </div>
                <span className="text-body font-medium text-[var(--color-text)] tabular-nums ml-4">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {expenses.length >= 10 && (
        <p className="text-caption text-[var(--color-text-muted)] text-center pt-2">
          Showing latest 10 expenses
        </p>
      )}
    </div>
  );
}
