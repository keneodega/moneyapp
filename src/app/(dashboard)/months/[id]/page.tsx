import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardHeader, BudgetProgress } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { IncomeList } from './IncomeList';
import { MonthActions } from './MonthActions';

interface MonthData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_income?: number;
  total_budgeted?: number;
  amount_unallocated?: number;
}

interface BudgetData {
  id: string;
  name: string;
  budget_amount: number;
  amount_spent: number;
  amount_left: number;
}

interface IncomeData {
  id: string;
  source: string;
  person?: string;
  amount: number;
  date_paid: string;
}

async function getMonthData(id: string): Promise<{
  month: MonthData;
  budgets: BudgetData[];
  income: IncomeData[];
} | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // Always calculate manually for reliability
    const { data: baseMonth, error: baseError } = await supabase
      .from('monthly_overviews')
      .select('*')
      .eq('id', id)
      .single();

    if (baseError || !baseMonth) {
      return null;
    }

    // Calculate totals manually
    const { data: incomeAmounts, error: incomeError } = await supabase
      .from('income_sources')
      .select('amount')
      .eq('monthly_overview_id', id);
    
    if (incomeError) {
      console.error(`Error fetching income for month ${id}:`, incomeError);
    }
    
    const totalIncome = incomeAmounts && !incomeError
      ? incomeAmounts.reduce((sum, i) => {
          const amount = typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    const { data: budgetAmounts, error: budgetsError } = await supabase
      .from('budgets')
      .select('budget_amount')
      .eq('monthly_overview_id', id);
    
    if (budgetsError) {
      console.error(`Error fetching budgets for month ${id}:`, budgetsError);
    }
    
    const totalBudgeted = budgetAmounts && !budgetsError
      ? budgetAmounts.reduce((sum, b) => {
          const amount = typeof b.budget_amount === 'string' ? parseFloat(b.budget_amount) : Number(b.budget_amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    const month = {
      ...baseMonth,
      total_income: totalIncome,
      total_budgeted: totalBudgeted,
      total_spent: 0, // Will be calculated from budget_summary below
      amount_unallocated: totalIncome - totalBudgeted,
    };

    // Fetch budgets with summary and master budget info
    // Query budgets table directly and calculate spent amount manually
    // This is more reliable than using the view which may be missing columns
    let budgetsData: any[] | null = null;
    let budgetsQueryError: any = null;
    
    // Try to fetch with master_budget join first
    const { data: budgetsWithMaster, error: budgetsWithMasterError } = await supabase
      .from('budgets')
      .select(`
        *,
        master_budget:master_budgets(budget_amount, name)
      `)
      .eq('monthly_overview_id', id)
      .order('name');
    
    if (budgetsWithMasterError) {
      console.error(`Error fetching budgets with master_budget join for month ${id}:`, budgetsWithMasterError);
      // Fallback: try without the join if the join fails
      const { data: budgetsWithoutMaster, error: budgetsWithoutMasterError } = await supabase
        .from('budgets')
        .select('*')
        .eq('monthly_overview_id', id)
        .order('name');
      
      if (budgetsWithoutMasterError) {
        console.error(`Error fetching budgets without join for month ${id}:`, budgetsWithoutMasterError);
        budgetsQueryError = budgetsWithoutMasterError;
      } else {
        budgetsData = budgetsWithoutMaster;
      }
    } else {
      budgetsData = budgetsWithMaster;
    }
    
    if (budgetsQueryError && !budgetsData) {
      console.error(`Failed to fetch budgets for month ${id}:`, budgetsQueryError);
    }
    
    // Calculate spent amount for each budget
    const budgets = await Promise.all(
      (budgetsData || []).map(async (budget) => {
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('amount')
          .eq('budget_id', budget.id);
        
        if (expensesError) {
          console.error(`Error fetching expenses for budget ${budget.id}:`, expensesError);
        }
        
        const amount_spent = expenses?.reduce((sum, e) => {
          const amount = typeof e.amount === 'string' ? parseFloat(e.amount) : Number(e.amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0) || 0;
        
        return {
          id: budget.id,
          monthly_overview_id: budget.monthly_overview_id,
          name: budget.name,
          budget_amount: budget.budget_amount,
          amount_spent,
          amount_left: Number(budget.budget_amount) - amount_spent,
          percent_used: Number(budget.budget_amount) > 0 
            ? (amount_spent / Number(budget.budget_amount)) * 100 
            : 0,
          description: budget.description,
          master_budget_id: budget.master_budget_id,
          override_amount: budget.override_amount,
          override_reason: budget.override_reason,
          master_budget: budget.master_budget,
          created_at: budget.created_at,
          updated_at: budget.updated_at,
        };
      })
    );

    // Fetch income
    const { data: income } = await supabase
      .from('income_sources')
      .select('*')
      .eq('monthly_overview_id', id)
      .order('date_paid', { ascending: false });

    // Calculate total spent from budgets
    const totalSpent = budgets && budgets.length > 0
      ? budgets.reduce((sum, b) => {
          const amount = typeof b.amount_spent === 'string' ? parseFloat(b.amount_spent) : Number(b.amount_spent || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0)
      : 0;

    // Update month with total_spent
    month.total_spent = totalSpent;

    return {
      month,
      budgets: budgets || [],
      income: income || [],
    };
  } catch {
    return null;
  }
}

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
  });
}

export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMonthData(id);
  
  if ( !data) {
    notFound();
  }

  const { month, budgets, income } = data;
  
  // Use totals from view (more accurate than manual calculation)
  const totalIncome = month.total_income || 0;
  const totalBudgeted = month.total_budgeted || 0;
  const unallocated = month.amount_unallocated || 0;
  
  // Calculate spent from budgets (view provides this per budget)
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.amount_spent || 0), 0);
  const spentPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/months"
            className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[var(--color-text)]" />
          </Link>
          <div>
            <h1 className="text-display text-[var(--color-text)]">{month.name}</h1>
            <p className="text-body text-[var(--color-text-muted)] mt-1">
              {formatDate(month.start_date)} - {formatDate(month.end_date)}
            </p>
          </div>
        </div>
        <MonthActions monthId={id} monthName={month.name} />
      </div>

      {/* Dashboard Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Income */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Income</p>
              <p className="text-headline text-[var(--color-success)] mt-1 tabular-nums">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 flex items-center justify-center">
              <ArrowUpIcon className="w-5 h-5 text-[var(--color-success)]" />
            </div>
          </div>
        </Card>

        {/* Total Budgeted */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Budgeted</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(totalBudgeted)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
          </div>
        </Card>

        {/* Total Spent */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Total Spent</p>
              <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
                {formatCurrency(totalSpent)}
              </p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                {spentPercent.toFixed(0)}% of budget
              </p>
            </div>
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
          </div>
        </Card>

        {/* Unallocated */}
        <Card variant="raised" padding="md" className="animate-slide-up stagger-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small text-[var(--color-text-muted)]">Unallocated</p>
              <p className={`text-headline mt-1 tabular-nums ${
                unallocated >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
              }`}>
                {formatCurrency(unallocated)}
              </p>
              <p className="text-caption text-[var(--color-text-subtle)] mt-1">
                {unallocated >= 0 ? 'Available to budget' : 'Over-budgeted'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center ${
              unallocated >= 0 ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--color-danger)]/10'
            }`}>
              <BanknoteIcon className={`w-5 h-5 ${
                unallocated >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
              }`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Categories */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title text-[var(--color-text)]">Budget Categories</h2>
              <p className="text-small text-[var(--color-text-muted)] mt-1">
                Select budgets from <Link href="/master-budgets" className="text-[var(--color-primary)] hover:underline">Master Budgets</Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/months/${id}/budgets/select`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text)] text-small font-medium hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Budget
              </Link>
              <Link
                href={`/months/${id}/expense/new`}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-small font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Expense
              </Link>
            </div>
          </div>
          
          {budgets.length > 0 ? (
            <div className="grid gap-3">
              {budgets.map((budget: any, index) => {
                const percent = budget.budget_amount > 0 
                  ? (budget.amount_spent / budget.budget_amount) * 100 
                  : 0;
                
                // Calculate deviation from master budget
                const masterAmount = budget.master_budget?.budget_amount;
                const effectiveAmount = budget.override_amount ?? budget.budget_amount;
                const deviation = masterAmount && Math.abs(effectiveAmount - masterAmount) > 0.01
                  ? effectiveAmount - masterAmount
                  : null;
                const deviationPercent = deviation && masterAmount && masterAmount > 0
                  ? ((deviation / masterAmount) * 100).toFixed(1)
                  : null;
                
                return (
                  <Link 
                    key={budget.id}
                    href={`/months/${id}/budgets/${budget.id}`}
                    className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}
                  >
                    <Card variant="outlined" padding="md" hover>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-body font-medium text-[var(--color-text)]">
                            {budget.name}
                          </h3>
                          {deviation !== null && (
                            <p className={`text-caption mt-0.5 ${
                              deviation > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'
                            }`}>
                              {deviation > 0 ? '↑' : '↓'} {deviation > 0 ? '+' : ''}€{Math.abs(deviation).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {deviationPercent && ` (${deviation > 0 ? '+' : ''}${deviationPercent}%)`}
                              {' '}from master
                            </p>
                          )}
                          {budget.override_reason && (
                            <p className="text-caption text-[var(--color-text-muted)] mt-0.5 italic">
                              "{budget.override_reason}"
                            </p>
                          )}
                        </div>
                        <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                          {formatCurrency(effectiveAmount)}
                        </span>
                      </div>
                      <BudgetProgress 
                        spent={budget.amount_spent} 
                        total={effectiveAmount} 
                      />
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card variant="outlined" padding="lg" className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
                <PieChartIcon className="w-6 h-6 text-[var(--color-text-subtle)]" />
              </div>
              <h3 className="text-title text-[var(--color-text)] mb-2">No budgets yet</h3>
              <p className="text-body text-[var(--color-text-muted)] mb-4">
                Create budget categories to start tracking your spending.
              </p>
              <Link
                href={`/months/${id}/budgets/select`}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Select Budgets
              </Link>
            </Card>
          )}
        </div>

        {/* Income Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title text-[var(--color-text)]">Income</h2>
            <Link
              href={`/months/${id}/income/new`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-small font-medium hover:bg-[var(--color-accent-dark)] transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Income
            </Link>
          </div>
          
          <Card variant="outlined" padding="none">
            <IncomeList income={income} monthId={id} />
          </Card>

          {/* Quick Stats */}
          <Card variant="default" padding="md" className="bg-gradient-warm">
            <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
              Month Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Days remaining</span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {Math.max(0, Math.ceil((new Date(month.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Budgets on track</span>
                <span className="text-small font-medium text-[var(--color-success)]">
                  {budgets.filter(b => b.amount_left >= 0).length} / {budgets.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Avg. daily spend</span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {formatCurrency(totalSpent / Math.max(1, Math.ceil((new Date().getTime() - new Date(month.start_date).getTime()) / (1000 * 60 * 60 * 24))))}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
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

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function BanknoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}
