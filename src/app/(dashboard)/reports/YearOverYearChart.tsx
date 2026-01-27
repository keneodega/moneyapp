'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card } from '@/components/ui';
import type { YearOverYearData } from '@/lib/services/reports.service';

interface YearOverYearChartProps {
  data: YearOverYearData[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 shadow-lg">
        <p className="text-small font-medium text-[var(--color-text)] mb-2">
          Year {payload[0].payload.year}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-small" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function YearOverYearChart({ data }: YearOverYearChartProps) {
  const chartData = useMemo(() => {
    return data.map((year) => ({
      year: year.year.toString(),
      'Total Spent': year.totalSpent,
      'Total Income': year.totalIncome,
      'Total Budgeted': year.totalBudgeted,
      'Savings': year.savings,
      'Avg Monthly Spending': year.averageMonthlySpending,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card variant="outlined" padding="lg" className="text-center">
        <p className="text-body text-[var(--color-text-muted)]">
          No year-over-year data available.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparison Bar Chart */}
      <Card variant="raised" padding="md">
        <h3 className="text-title text-[var(--color-text)] mb-6">Year-over-Year Comparison</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="year"
                stroke="var(--color-text-muted)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Total Income" fill="var(--color-success)" />
              <Bar dataKey="Total Budgeted" fill="var(--color-primary)" />
              <Bar dataKey="Total Spent" fill="var(--color-danger)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Savings Trend Line Chart */}
      <Card variant="raised" padding="md">
        <h3 className="text-title text-[var(--color-text)] mb-6">Savings Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="year"
                stroke="var(--color-text-muted)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Savings"
                stroke="var(--color-success)"
                strokeWidth={3}
                dot={{ r: 6 }}
                name="Savings"
              />
              <Line
                type="monotone"
                dataKey="Avg Monthly Spending"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Avg Monthly Spending"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((yearData) => (
          <Card key={yearData.year} variant="outlined" padding="md">
            <h4 className="text-headline text-[var(--color-text)] mb-4">{yearData.year}</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Total Spent</span>
                <span className="text-small font-medium text-[var(--color-danger)]">
                  {formatCurrency(yearData.totalSpent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Total Income</span>
                <span className="text-small font-medium text-[var(--color-success)]">
                  {formatCurrency(yearData.totalIncome)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">Total Budgeted</span>
                <span className="text-small font-medium text-[var(--color-primary)]">
                  {formatCurrency(yearData.totalBudgeted)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                <span className="text-body font-medium text-[var(--color-text)]">Savings</span>
                <span
                  className={`text-body font-medium ${
                    yearData.savings >= 0
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-danger)]'
                  }`}
                >
                  {formatCurrency(yearData.savings)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-small text-[var(--color-text-muted)]">
                  Avg Monthly Spending
                </span>
                <span className="text-small font-medium text-[var(--color-text)]">
                  {formatCurrency(yearData.averageMonthlySpending)}
                </span>
              </div>
            </div>

            {/* Top Categories */}
            {yearData.topCategories.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-caption text-[var(--color-text-muted)] mb-2">
                  Top Categories
                </p>
                <div className="space-y-1">
                  {yearData.topCategories.map((cat) => (
                    <div key={cat.category} className="flex justify-between">
                      <span className="text-caption text-[var(--color-text-muted)]">
                        {cat.category}
                      </span>
                      <span className="text-caption font-medium text-[var(--color-text)]">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Trend Analysis */}
      {data.length > 1 && (
        <Card variant="raised" padding="md">
          <h3 className="text-title text-[var(--color-text)] mb-4">Trend Analysis</h3>
          <div className="space-y-2">
            {data.slice(1).map((yearData, index) => {
              const previousYear = data[index];
              const spentChange =
                ((yearData.totalSpent - previousYear.totalSpent) / previousYear.totalSpent) * 100;
              const incomeChange =
                ((yearData.totalIncome - previousYear.totalIncome) / previousYear.totalIncome) *
                100;
              const savingsChange = yearData.savings - previousYear.savings;

              return (
                <div
                  key={yearData.year}
                  className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
                >
                  <p className="text-small font-medium text-[var(--color-text)] mb-2">
                    {previousYear.year} → {yearData.year}
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-caption">
                    <div>
                      <span className="text-[var(--color-text-muted)]">Spending: </span>
                      <span
                        className={
                          spentChange > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
                        }
                      >
                        {spentChange > 0 ? '+' : ''}
                        {spentChange.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)]">Income: </span>
                      <span
                        className={
                          incomeChange > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                        }
                      >
                        {incomeChange > 0 ? '+' : ''}
                        {incomeChange.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)]">Savings: </span>
                      <span
                        className={
                          savingsChange > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                        }
                      >
                        {savingsChange > 0 ? '+' : ''}
                        {formatCurrency(savingsChange)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
