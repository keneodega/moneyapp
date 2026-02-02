import { ReactNode } from 'react';
import { Card } from './Card';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <Card
      variant="outlined"
      padding="md"
      className={`bg-[var(--color-surface-sunken)]/60 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-[var(--color-text)]">{title}</h1>
          {subtitle ? (
            <p className="text-body text-[var(--color-text-muted)] mt-1">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </Card>
  );
}
