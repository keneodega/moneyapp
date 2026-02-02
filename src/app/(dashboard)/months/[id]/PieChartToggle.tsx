'use client';

import { useState } from 'react';
import { Card, PieChart } from '@/components/ui';

interface ChartData {
  name: string;
  value: number;
}

interface PieChartToggleProps {
  budgetData: ChartData[];
  incomeData: ChartData[];
}

export function PieChartToggle({ budgetData, incomeData }: PieChartToggleProps) {
  const [activeChart, setActiveChart] = useState<'budget' | 'income'>('budget');

  const hasBudgetData = budgetData.length > 0;
  const hasIncomeData = incomeData.length > 0;

  // If no data for either chart, don't render
  if (!hasBudgetData && !hasIncomeData) {
    return null;
  }

  // If only one chart has data, show it without toggle
  if (hasBudgetData && !hasIncomeData) {
    return (
      <Card variant="outlined" padding="md">
        <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
          Budget allocation
        </h3>
        <PieChart
          data={budgetData}
          showLegend={true}
          showLabels={false}
          height={360}
          innerRadius={70}
          outerRadius={120}
        />
      </Card>
    );
  }

  if (!hasBudgetData && hasIncomeData) {
    return (
      <Card variant="outlined" padding="md">
        <h3 className="text-small font-medium text-[var(--color-text-muted)] mb-4">
          Income breakdown
        </h3>
        <PieChart
          data={incomeData}
          showLegend={true}
          showLabels={false}
          height={360}
          innerRadius={70}
          outerRadius={120}
        />
      </Card>
    );
  }

  return (
    <Card variant="outlined" padding="md">
      {/* Toggle buttons */}
      <div className="flex items-center gap-1 p-1 mb-4 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]">
        <button
          onClick={() => setActiveChart('budget')}
          className={`flex-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium transition-colors ${
            activeChart === 'budget'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Budget allocation
        </button>
        <button
          onClick={() => setActiveChart('income')}
          className={`flex-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-small font-medium transition-colors ${
            activeChart === 'income'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Income breakdown
        </button>
      </div>

      {/* Chart */}
      <PieChart
        data={activeChart === 'budget' ? budgetData : incomeData}
        showLegend={true}
        showLabels={false}
        height={360}
        innerRadius={70}
        outerRadius={120}
      />
    </Card>
  );
}
