import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MonthsList } from './MonthsList';

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
        
        if (incomeError) {
          console.error(`Error fetching income for month ${month.id}:`, incomeError);
        }
        
        const totalIncome = income && !incomeError 
          ? income.reduce((sum, i) => {
              const amount = typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount || 0);
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0) 
          : 0;

        // Get budget total
        const { data: budgets, error: budgetsError } = await supabase
          .from('budgets')
          .select('budget_amount')
          .eq('monthly_overview_id', month.id);
        
        if (budgetsError) {
          console.error(`Error fetching budgets for month ${month.id}:`, budgetsError);
        }
        
        const totalBudgeted = budgets && !budgetsError
          ? budgets.reduce((sum, b) => {
              const amount = typeof b.budget_amount === 'string' ? parseFloat(b.budget_amount) : Number(b.budget_amount || 0);
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0)
          : 0;

        // Get spent total from budget_summary view
        const { data: budgetSummaries, error: spentError } = await supabase
          .from('budget_summary')
          .select('amount_spent')
          .eq('monthly_overview_id', month.id);
        
        if (spentError) {
          console.error(`Error fetching spent for month ${month.id}:`, spentError);
        }
        
        const totalSpent = budgetSummaries && !spentError
          ? budgetSummaries.reduce((sum, b) => {
              const amount = typeof b.amount_spent === 'string' ? parseFloat(b.amount_spent) : Number(b.amount_spent || 0);
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0)
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
      <MonthsList months={months} groupedByYear={groupedMonths} years={years} />

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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
