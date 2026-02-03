'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, DashboardTile, ProgressBar, SkeletonCard } from '@/components/ui';

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

  const loadBudgetData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error getting user:', userError);
        return;
      }

      if (!user) {
        console.log('No user found');
        return;
      }

      // Get all months that overlap with the date range
      // A month overlaps if: month.start_date <= dateRange.end AND month.end_date >= dateRange.start
      const startDateStr = dateRange.start.toISOString().split('T')[0];
      const endDateStr = dateRange.end.toISOString().split('T')[0];
      
      console.log('Loading budget data for date range:', { startDateStr, endDateStr });
      
      // First, get all months for the user
      const { data: allMonths, error: monthsError } = await supabase
        .from('monthly_overviews')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (monthsError) {
        console.error('Error fetching months:', monthsError);
        setBudgetData([]);
        return;
      }

      if (!allMonths || allMonths.length === 0) {
        console.log('No months found for user:', user.id);
        setBudgetData([]);
        return;
      }

      // Filter months that overlap with the date range
      const months = allMonths.filter((month) => {
        const monthStart = new Date(month.start_date);
        const monthEnd = new Date(month.end_date);
        const rangeStart = dateRange.start;
        const rangeEnd = dateRange.end;
        
        // Month overlaps if: monthStart <= rangeEnd AND monthEnd >= rangeStart
        const overlaps = monthStart <= rangeEnd && monthEnd >= rangeStart;
        
        if (overlaps) {
          console.log(`Month ${month.name} overlaps:`, {
            monthStart: month.start_date,
            monthEnd: month.end_date,
            rangeStart: startDateStr,
            rangeEnd: endDateStr,
          });
        }
        
        return overlaps;
      });

      if (monthsError) {
        console.error('Error fetching months:', monthsError);
        setBudgetData([]);
        return;
      }

      if (!months || months.length === 0) {
        console.log('No months found for date range:', {
          start: startDateStr,
          end: endDateStr,
          userId: user.id,
        });
        setBudgetData([]);
        return;
      }

      console.log(`Found ${months.length} months for date range:`, months.map(m => `${m.name} (${m.start_date} to ${m.end_date})`));

      // Fetch budget data for each month
      const monthData: BudgetData[] = await Promise.all(
        months.map(async (month) => {
          // Get income
          const { data: income, error: incomeError } = await supabase
            .from('income_sources')
            .select('amount')
            .eq('monthly_overview_id', month.id);

          if (incomeError) {
            console.error(`Error fetching income for ${month.name}:`, incomeError);
          }

          const totalIncome = income?.reduce((sum, i) => sum + Number(i.amount || 0), 0) || 0;

          // Get budgets
          const { data: budgets, error: budgetsError } = await supabase
            .from('budgets')
            .select('id, name, budget_amount')
            .eq('monthly_overview_id', month.id);

          if (budgetsError) {
            console.error(`Error fetching budgets for ${month.name}:`, budgetsError);
          }

          // Get expenses for each budget
          const budgetDetails = await Promise.all(
            (budgets || []).map(async (budget: any) => {
              const { data: expenses, error: expensesError } = await supabase
                .from('expenses')
                .select('amount')
                .eq('budget_id', budget.id);

              if (expensesError) {
                console.error(`Error fetching expenses for budget ${budget.name}:`, expensesError);
              }

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

          console.log(`Month ${month.name}:`, {
            totalIncome,
            totalBudgeted,
            totalSpent,
            budgetCount: budgetDetails.length,
          });

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

      console.log('Budget data loaded:', monthData);
      setBudgetData(monthData);
    } catch (error) {
      console.error('Failed to load budget data:', error);
      setBudgetData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadBudgetData();
  }, [loadBudgetData]);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Memoize expensive calculations
  const { totalBudgeted, totalSpent, totalIncome, savings } = useMemo(() => {
    const budgeted = budgetData.reduce((sum, m) => sum + m.totalBudgeted, 0);
    const spent = budgetData.reduce((sum, m) => sum + m.totalSpent, 0);
    const income = budgetData.reduce((sum, m) => sum + m.totalIncome, 0);
    return {
      totalBudgeted: budgeted,
      totalSpent: spent,
      totalIncome: income,
      savings: income - spent,
    };
  }, [budgetData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardTile
          title="Total Budgeted"
          value={formatCurrency(totalBudgeted)}
          helper="Across selected months"
          tone="primary"
        />
        <DashboardTile
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          helper="Actual expenditures"
          tone="warning"
        />
        <DashboardTile
          title="Total Income"
          value={formatCurrency(totalIncome)}
          helper="Reported income"
          tone="success"
        />
        <DashboardTile
          title="Savings"
          value={formatCurrency(savings)}
          helper="Income minus spend"
          tone={savings >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Monthly Breakdown */}
      <div className="space-y-4">
        <h3 className="text-body font-medium text-[var(--color-text)]">Monthly Breakdown</h3>
        {budgetData.length === 0 ? (
          <p className="text-body text-[var(--color-text-muted)]">No budget data in this period</p>
        ) : (
          <div className="space-y-3">
            {budgetData.map((month) => {
              const spentPercent = month.totalBudgeted > 0
                ? (month.totalSpent / month.totalBudgeted) * 100
                : 0;
              const isExpanded = selectedMonth === month.monthId;
              return (
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
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-body font-medium text-[var(--color-text)] tabular-nums">
                        {formatCurrency(month.totalSpent)} / {formatCurrency(month.totalBudgeted)}
                      </p>
                      <p className="text-caption text-[var(--color-text-muted)]">
                        {spentPercent.toFixed(1)}% spent
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMonth(isExpanded ? null : month.monthId)}
                      className="text-small font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                </div>
                <ProgressBar value={month.totalSpent} max={Math.max(1, month.totalBudgeted)} colorMode="budget" />

                {/* Budget Categories (collapsible) */}
                {isExpanded ? (
                  <div className="space-y-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                    {month.budgets.map((budget) => (
                      <div
                        key={budget.id}
                        className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-small font-medium text-[var(--color-text)]">
                            {budget.name}
                          </p>
                          <p className="text-caption text-[var(--color-text-muted)]">
                            {formatCurrency(budget.spent)} / {formatCurrency(budget.budgetAmount)}
                          </p>
                          <ProgressBar
                            value={budget.spent}
                            max={Math.max(1, budget.budgetAmount)}
                            colorMode="budget"
                            size="sm"
                          />
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
                  </div>
                ) : null}
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
