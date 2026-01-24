'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'outlined';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', hover = false, padding = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--color-surface-raised)]',
      raised: 'bg-[var(--color-surface-raised)] shadow-[var(--shadow-md)]',
      outlined: 'bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={`
          rounded-[var(--radius-lg)]
          ${variants[variant]}
          ${paddings[padding]}
          ${hover ? 'card-hover cursor-pointer' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', title, subtitle, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-start justify-between gap-4 mb-4 ${className}`}
        {...props}
      >
        <div>
          <h3 className="text-title text-[var(--color-text)]">{title}</h3>
          {subtitle && (
            <p className="text-small text-[var(--color-text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';
