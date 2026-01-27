'use client';

import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui';
import type { SpendingTrendDataPoint, TimePeriod } from '@/lib/services/reports.service';

interface SpendingTrendsChartProps {
  data: SpendingTrendDataPoint[];
  period: TimePeriod;
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
          {payload[0].payload.period}
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

export function SpendingTrendsChart({ data, period }: SpendingTrendsChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map((point) => ({
      period: point.period,
      Income: point.totalIncome,
      Budgeted: point.totalBudgeted,
      Spent: point.totalSpent,
      Savings: point.savings,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card variant="outlined" padding="lg" className="text-center">
        <p className="text-body text-[var(--color-text-muted)]">
          No spending data available for the selected period.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Line Chart for Trends */}
      <Card variant="raised" padding="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-title text-[var(--color-text)]">Spending Trends Over Time</h3>
            <span className="text-caption text-[var(--color-text-muted)]">
              {period === 'month' ? 'Monthly' : period === 'quarter' ? 'Quarterly' : 'Yearly'}
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="period"
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
                  dataKey="Income"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="Budgeted"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Budgeted"
                />
                <Line
                  type="monotone"
                  dataKey="Spent"
                  stroke="var(--color-danger)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Spent"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Bar Chart Comparison */}
      <Card variant="raised" padding="md">
        <div className="space-y-4">
          <h3 className="text-title text-[var(--color-text)]">Income vs Budgeted vs Spent</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="period"
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
                <Bar dataKey="Income" fill="var(--color-success)" name="Income" />
                <Bar dataKey="Budgeted" fill="var(--color-primary)" name="Budgeted" />
                <Bar dataKey="Spent" fill="var(--color-danger)" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="outlined" padding="md">
          <p className="text-caption text-[var(--color-text-muted)]">Total Spent</p>
          <p className="text-title font-medium text-[var(--color-danger)] mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.totalSpent, 0))}
          </p>
        </Card>
        <Card variant="outlined" padding="md">
          <p className="text-caption text-[var(--color-text-muted)]">Total Income</p>
          <p className="text-title font-medium text-[var(--color-success)] mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.totalIncome, 0))}
          </p>
        </Card>
        <Card variant="outlined" padding="md">
          <p className="text-caption text-[var(--color-text-muted)]">Total Budgeted</p>
          <p className="text-title font-medium text-[var(--color-primary)] mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.totalBudgeted, 0))}
          </p>
        </Card>
        <Card variant="outlined" padding="md">
          <p className="text-caption text-[var(--color-text-muted)]">Total Savings</p>
          <p className="text-title font-medium text-[var(--color-success)] mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.savings, 0))}
          </p>
        </Card>
      </div>
    </div>
  );
}
