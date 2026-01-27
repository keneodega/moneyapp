'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui';
import type { CategoryBreakdownData } from '@/lib/services/reports.service';

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownData[];
}

const COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
];

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
    const data = payload[0].payload;
    return (
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 shadow-lg">
        <p className="text-small font-medium text-[var(--color-text)] mb-2">
          {data.name}
        </p>
        <p className="text-small" style={{ color: payload[0].color }}>
          Spent: {formatCurrency(data.value)}
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          Budgeted: {formatCurrency(data.budgeted)}
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          {data.percentage.toFixed(1)}% of total
        </p>
        <p className="text-small text-[var(--color-text-muted)]">
          {data.transactions} transactions
        </p>
      </div>
    );
  }
  return null;
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: item.category,
      value: item.totalSpent,
      percentage: item.percentage,
      budgeted: item.totalBudgeted,
      transactions: item.transactionCount,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card variant="outlined" padding="lg" className="text-center">
        <p className="text-body text-[var(--color-text-muted)]">
          No category data available for the selected period.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card variant="raised" padding="md">
          <h3 className="text-title text-[var(--color-text)] mb-6">Category Breakdown</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Bar Chart */}
        <Card variant="raised" padding="md">
          <h3 className="text-title text-[var(--color-text)] mb-6">Spending by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  stroke="var(--color-text-muted)"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--color-text-muted)"
                  style={{ fontSize: '12px' }}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="var(--color-primary)" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Category Details Table */}
      <Card variant="raised" padding="md">
        <h3 className="text-title text-[var(--color-text)] mb-4">Category Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-small font-medium text-[var(--color-text-muted)] py-2">Category</th>
                <th className="text-right text-small font-medium text-[var(--color-text-muted)] py-2">Spent</th>
                <th className="text-right text-small font-medium text-[var(--color-text-muted)] py-2">Budgeted</th>
                <th className="text-right text-small font-medium text-[var(--color-text-muted)] py-2">Difference</th>
                <th className="text-right text-small font-medium text-[var(--color-text-muted)] py-2">% of Total</th>
                <th className="text-right text-small font-medium text-[var(--color-text-muted)] py-2">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const difference = item.totalSpent - item.totalBudgeted;
                const isOverBudget = difference > 0;
                return (
                  <tr key={item.category} className="border-b border-[var(--color-border)]">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-small font-medium text-[var(--color-text)]">
                          {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="text-right text-small font-medium text-[var(--color-text)] py-3">
                      {formatCurrency(item.totalSpent)}
                    </td>
                    <td className="text-right text-small text-[var(--color-text-muted)] py-3">
                      {formatCurrency(item.totalBudgeted)}
                    </td>
                    <td className={`text-right text-small font-medium py-3 ${
                      isOverBudget ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
                    }`}>
                      {isOverBudget ? '+' : ''}{formatCurrency(difference)}
                    </td>
                    <td className="text-right text-small text-[var(--color-text-muted)] py-3">
                      {item.percentage.toFixed(1)}%
                    </td>
                    <td className="text-right text-small text-[var(--color-text-muted)] py-3">
                      {item.transactionCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
