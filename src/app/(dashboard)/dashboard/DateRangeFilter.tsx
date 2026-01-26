'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeFilterProps {
  period: PeriodType;
  dateRange: DateRange;
  onPeriodChange: (period: PeriodType) => void;
  onDateRangeChange: (range: DateRange) => void;
}

export function DateRangeFilter({
  period,
  dateRange,
  onPeriodChange,
  onDateRangeChange,
}: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(period === 'custom');

  const periods: Array<{ value: PeriodType; label: string }> = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    const date = new Date(value);
    if (type === 'start') {
      onDateRangeChange({ ...dateRange, start: date });
    } else {
      onDateRangeChange({ ...dateRange, end: date });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Period Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {periods.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? 'primary' : 'secondary'}
            onClick={() => {
              onPeriodChange(p.value);
              setShowCustom(p.value === 'custom');
            }}
            className="text-small"
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Inputs */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start.toISOString().split('T')[0]}
            onChange={(e) => handleCustomDateChange('start', e.target.value)}
            className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small"
          />
          <span className="text-[var(--color-text-muted)]">to</span>
          <input
            type="date"
            value={dateRange.end.toISOString().split('T')[0]}
            onChange={(e) => handleCustomDateChange('end', e.target.value)}
            className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-small"
          />
        </div>
      )}
    </div>
  );
}
