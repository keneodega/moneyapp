import Link from 'next/link';
import { Card } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface MonthData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_income?: number;
  total_budgeted?: number;
  total_spent?: number;
  amount_unallocated?: number;
}

async function getMonths(): Promise<MonthData[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    // Always calculate manually for now (more reliable than view)
    // Fetch from base table and calculate manually
    const { data: months, error: monthsError } = await supabase
      .from('monthly_overviews')
      .select('*')
      .order('start_date', { ascending: false });

    if (monthsError || !months || months.length === 0) {
      return [];
    }

    // Calculate totals for each month
    const monthsWithTotals = await Promise.all(
      months.map(async (month) => {
        // Get income total
        const { data: income, error: incomeError } = await supabase
          .from('income_sources')
          .select('amount')
          .eq('monthly_overview_id', month.id);
        const totalIncome = income && !incomeError 
          ? income.reduce((sum, i) => sum + Number(i.amount || 0), 0) 
          : 0;

        // Get budget total
        const { data: budgets, error: budgetsError } = await supabase
          .from('budgets')
          .select('budget_amount')
          .eq('monthly_overview_id', month.id);
        const totalBudgeted = budgets && !budgetsError
          ? budgets.reduce((sum, b) => sum + Number(b.budget_amount || 0), 0)
          : 0;

        // Get spent total from budget_summary view
        const { data: budgetSummaries, error: spentError } = await supabase
          .from('budget_summary')
          .select('amount_spent')
          .eq('monthly_overview_id', month.id);
        const totalSpent = budgetSummaries && !spentError
          ? budgetSummaries.reduce((sum, b) => sum + Number(b.amount_spent || 0), 0)
          : 0;

        return {
          ...month,
          total_income: totalIncome,
          total_budgeted: totalBudgeted,
          total_spent: totalSpent,
          amount_unallocated: totalIncome - totalBudgeted,
        };
      })
    );

    return monthsWithTotals;
  } catch (err) {
    console.error('Error fetching months:', err);
    return [];
  }
}

function groupByYear(months: MonthData[]): Record<string, MonthData[]> {
  return months.reduce((acc, month) => {
    const year = new Date(month.start_date).getFullYear().toString();
    if ( !acc[year]) {
      acc[year] = [];
    }
    acc[year].push(month);
    return acc;
  }, {} as Record<string, MonthData[]>);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isCurrentMonth(startDate: string, endDate: string): boolean {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
}

export default async function MonthsPage() {
  const months = await getMonths();
  const groupedMonths = groupByYear(months);
  const years = Object.keys(groupedMonths).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-[var(--color-text)]">Monthly Budgets</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-2">
            Track your income and expenses month by month
          </p>
        </div>
        <Link
          href="/months/new"
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New Month
        </Link>
      </div>

      {/* Months by Year */}
      {years.map((year, yearIndex) => (
        <section key={year} className={`animate-slide-up stagger-${yearIndex + 1}`}>
          <h2 className="text-headline text-[var(--color-text)] mb-4">{year}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupedMonths[year].map((month, monthIndex) => {
              const isCurrent = isCurrentMonth(month.start_date, month.end_date);
              const spentPercent = month.total_budgeted 
                ? ((month.total_spent || 0) / month.total_budgeted) * 100 
                : 0;
              
              return (
                <Link 
                  key={month.id} 
                  href={`/months/${month.id}`}
                  className={`animate-slide-up stagger-${monthIndex + 1}`}
                >
                  <Card 
                    variant={isCurrent ? 'raised' : 'outlined'} 
                    hover 
                    padding="md"
                    className={isCurrent ? 'ring-2 ring-[var(--color-primary)]/30' : ''}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-title text-[var(--color-text)]">{month.name}</h3>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-caption font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                            Current
                          </span>
                        )}
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-[var(--color-text-subtle)]" />
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-small text-[var(--color-text-muted)]">Income</span>
                        <span className="text-small font-medium text-[var(--color-success)] tabular-nums">
                          {formatCurrency(month.total_income || 0)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-small text-[var(--color-text-muted)]">Budgeted</span>
                        <span className="text-small font-medium text-[var(--color-text)] tabular-nums">
                          {formatCurrency(month.total_budgeted || 0)}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-caption text-[var(--color-text-muted)]">Spent</span>
                          <span className="text-caption text-[var(--color-text-muted)] tabular-nums">
                            {spentPercent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              spentPercent >= 100 ? 'bg-[var(--color-danger)]' :
                              spentPercent >= 80 ? 'bg-[var(--color-warning)]' :
                              'bg-[var(--color-accent)]'
                            }`}
                            style={{ width: `${Math.min(100, spentPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {/* Empty State */}
      {months.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center">
            <CalendarIcon className="w-8 h-8 text-[var(--color-text-subtle)]" />
          </div>
          <h3 className="text-title text-[var(--color-text)] mb-2">No months yet</h3>
          <p className="text-body text-[var(--color-text-muted)] mb-6">
            Create your first monthly budget to get started
          </p>
          <Link
            href="/months/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Month
          </Link>
        </div>
      )}
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
