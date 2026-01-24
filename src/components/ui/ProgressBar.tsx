'use client';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  colorMode?: 'default' | 'budget';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  colorMode = 'default',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const getBarColor = () => {
    if (colorMode === 'budget') {
      if (percentage >= 100) return 'bg-[var(--color-danger)]';
      if (percentage >= 80) return 'bg-[var(--color-warning)]';
      return 'bg-[var(--color-accent)]';
    }
    return 'bg-[var(--color-primary)]';
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className={`progress-bar ${sizes[size]}`}>
        <div
          className={`progress-bar-fill ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-caption text-[var(--color-text-muted)]">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

interface BudgetProgressProps {
  spent: number;
  total: number;
  currency?: string;
  className?: string;
}

export function BudgetProgress({
  spent,
  total,
  currency = 'EUR',
  className = '',
}: BudgetProgressProps) {
  const percentage = total > 0 ? (spent / total) * 100 : 0;
  const remaining = total - spent;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const getStatusColor = () => {
    if (percentage >= 100) return 'text-[var(--color-danger)]';
    if (percentage >= 80) return 'text-[var(--color-warning)]';
    return 'text-[var(--color-text-muted)]';
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <ProgressBar value={spent} max={total} colorMode="budget" size="md" />
      <div className="flex justify-between items-center">
        <span className="text-small text-[var(--color-text-muted)]">
          {formatCurrency(spent)} spent
        </span>
        <span className={`text-small font-medium ${getStatusColor()}`}>
          {remaining >= 0 ? formatCurrency(remaining) : `-${formatCurrency(Math.abs(remaining))}`} left
        </span>
      </div>
    </div>
  );
}
