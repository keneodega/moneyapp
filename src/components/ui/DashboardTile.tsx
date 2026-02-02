import { Card } from './Card';

type TileTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

interface DashboardTileProps {
  title: string;
  value: string;
  helper?: string;
  tone?: TileTone;
  className?: string;
}

const toneAccent: Record<TileTone, string> = {
  default: 'bg-[var(--color-border)]',
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
};

const toneValue: Record<TileTone, string> = {
  default: 'text-[var(--color-text)]',
  primary: 'text-[var(--color-primary)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
};

export function DashboardTile({
  title,
  value,
  helper,
  tone = 'default',
  className = '',
}: DashboardTileProps) {
  return (
    <Card
      variant="outlined"
      padding="lg"
      className={`relative overflow-hidden bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-sunken)]/60 ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${toneAccent[tone]}`} />
      <p className="text-small text-[var(--color-text-muted)]">{title}</p>
      <p className={`text-display mt-2 tabular-nums ${toneValue[tone]}`}>{value}</p>
      {helper ? (
        <p className="text-caption text-[var(--color-text-subtle)] mt-1">{helper}</p>
      ) : null}
    </Card>
  );
}
