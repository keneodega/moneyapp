'use client';

interface CurrencyProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  colorCode?: boolean;
  className?: string;
}

export function Currency({
  amount,
  currency = 'EUR',
  size = 'md',
  showSign = false,
  colorCode = false,
  className = '',
}: CurrencyProps) {
  const formattedAmount = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
    xl: 'text-2xl font-bold',
  };

  const getColorClass = () => {
    if ( !colorCode) return '';
    if (amount > 0) return 'text-[var(--color-success)]';
    if (amount < 0) return 'text-[var(--color-danger)]';
    return 'text-[var(--color-text-muted)]';
  };

  const sign = showSign && amount > 0 ? '+' : amount < 0 ? '-' : '';

  return (
    <span className={`tabular-nums ${sizes[size]} ${getColorClass()} ${className}`}>
      {sign}{formattedAmount}
    </span>
  );
}

interface CurrencyLabelProps {
  label: string;
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  colorCode?: boolean;
}

export function CurrencyLabel({
  label,
  amount,
  currency = 'EUR',
  size = 'md',
  colorCode = false,
}: CurrencyLabelProps) {
  const labelSizes = {
    sm: 'text-caption',
    md: 'text-small',
    lg: 'text-body',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className={`${labelSizes[size]} text-[var(--color-text-muted)]`}>
        {label}
      </span>
      <Currency amount={amount} currency={currency} size={size} colorCode={colorCode} />
    </div>
  );
}
