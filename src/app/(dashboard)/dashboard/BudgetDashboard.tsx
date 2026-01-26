'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

interface DateRange {
  start: Date;
  end: Date;
}

interface BudgetDashboardProps {
  dateRange: DateRange;
}

interface BudgetData {
  monthId: string;
  monthName: string;
  totalBudgeted: number;
  totalSpent: number;
  totalIncome: number;
  unallocated: number;
  budgets: Array<{
    id: string;
    name: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
  }>;
}

export function BudgetDashboard({ dateRange }: BudgetDashboardProps) {
  const [budgetData, setBudgetData] = useState<BudgetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetData();
  }, [dateRange]);

  async function loadBudgetData() {
    try {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Get all months that overlap with the date range
      // A month overlaps if: month.start_date <= dateRange.end AND month.end_date >= dateRange.start
      const startDateStr = dateRange.start.toISOString().split('T')[0];
      const endDateStr = dateRange.end.toISOString().split('T')[0];
      
      const { data: months } = await supabase
        .from('monthly_overviews')
        .select('*')
        .eq('user_id', user.id)
        .lte('start_date', endDateStr)  // Month starts before or on the end of our range
        .gte('end_date', startDateStr)   // Month ends after or on the start of our range
        .order('start_date', { ascending: false });

      if (!months) {
        setBudgetData([]);
        return;
      }

      // Fetch budget data for each month
      const monthData: BudgetData[] = await Promise.all(
        months.map(async (month) => {
          // Get income
          const { data: income } = await supabase
            .from('income_sources')
            .select('amount')
            .eq('monthly_overview_id', month.id);

          const totalIncome = income?.reduce((sum, i) => sum + Number(i.amount || 0), 0) || 0;

          // Get budgets
          const { data: budgets } = await supabase
            .from('budgets')
            .select('id, name, budget_amount')
            .eq('monthly_overview_id', month.id);

          // Get expenses for each budget
          const budgetDetails = await Promise.all(
            (budgets || []).map(async (budget: any) => {
              const { data: expenses } = await supabase
                .from('expenses')
                .select('amount')
                .eq('budget_id', budget.id);

              const spent = (expenses || []).reduce(
                (sum: number, e: any) => sum + Number(e.amount || 0),
                0
              );
              
              return {
                id: budget.id,
                name: budget.name,
                budgetAmount: Number(budget.budget_amount || 0),
                spent,
                remaining: Number(budget.budget_amount || 0) - spent,
              };
            })
          );


          const totalBudgeted = budgetDetails.reduce((sum, b) => sum + b.budgetAmount, 0);
          const totalSpent = budgetDetails.reduce((sum, b) => sum + b.spent, 0);

          return {
            monthId: month.id,
            monthName: month.name,
            totalBudgeted,
            totalSpent,
            totalIncome,
            unallocated: totalIncome - totalBudgeted,
            budgets: budgetDetails,
          };
        })
      );

      setBudgetData(monthData);
    } catch (error) {
      console.error('Failed to load budget data:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return <div className="text-body text-[var(--color-text-muted)]">Loading budget data...</div>;
  }

  const totalBudgeted = budgetData.reduce((sum, m) => sum + m.totalBudgeted, 0);
  const totalSpent = budgetData.reduce((sum, m) => sum + m.totalSpent, 0);
  const totalIncome = budgetData.reduce((sum, m) => sum + m.totalIncome, 0);
  const totalUnallocated = totalIncome - totalBudgeted;
  const savings = totalIncome - totalSpent;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Budgeted</p>
          <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
            {formatCurrency(totalBudgeted)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Spent</p>
          <p className="text-headline text-[var(--color-text)] mt-1 tabular-nums">
            {formatCurrency(totalSpent)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Total Income</p>
          <p className="text-headline text-[var(--color-success)] mt-1 tabular-nums">
            {formatCurrency(totalIncome)}
          </p>
        </Card>
        <Card variant="raised" padding="md">
          <p className="text-small text-[var(--color-text-muted)]">Savings</p>
          <p className={`text-headline mt-1 tabular-nums ${
            savings >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}>
            {formatCurrency(savings)}
          </p>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <div className="space-y-4">
        <h3 className="text-body font-medium text-[var(--color-text)]">Monthly Breakdown</h3>
        {budgetData.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)]">No budget data in this period</p>
        ) : (
          <div className="space-y-3">
            {budgetData.map((month) => (
              <Card key={month.monthId} variant="outlined" padding="md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Link
                      href={`/months/${month.monthId}`}
                      className="text-body font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {month.monthName}
                    </Link>
                    <p className="text-caption text-[var(--color-text-muted)] mt-1">
                      {month.budgets.length} budget categories
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-medium text-[var(--color-text)] tabular-nums">
                      {formatCurrency(month.totalSpent)} / {formatCurrency(month.totalBudgeted)}
                    </p>
                    <p className="text-caption text-[var(--color-text-muted)]">
                      {month.totalBudgeted > 0
                        ? ((month.totalSpent / month.totalBudgeted) * 100).toFixed(1)
                        : 0}% spent
                    </p>
                  </div>
                </div>

                {/* Budget Categories (collapsible) */}
                {selectedMonth === month.monthId ? (
                  <div className="space-y-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                    {month.budgets.map((budget) => (
                      <div
                        key={budget.id}
                        className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
                      >
                        <div className="flex-1">
                          <p className="text-small font-medium text-[var(--color-text)]">
                            {budget.name}
                          </p>
                          <p className="text-caption text-[var(--color-text-muted)]">
                            {formatCurrency(budget.spent)} / {formatCurrency(budget.budgetAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-small font-medium text-[var(--color-text)] tabular-nums">
                            {formatCurrency(budget.remaining)}
                          </p>
                          <p className="text-caption text-[var(--color-text-muted)]">
                            {budget.budgetAmount > 0
                              ? ((budget.spent / budget.budgetAmount) * 100).toFixed(0)
                              : 0}%
                          </p>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setSelectedMonth(null)}
                      className="text-small text-[var(--color-primary)] hover:underline mt-2"
                    >
                      Hide details
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedMonth(month.monthId)}
                    className="text-small text-[var(--color-primary)] hover:underline mt-2"
                  >
                    View details
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
