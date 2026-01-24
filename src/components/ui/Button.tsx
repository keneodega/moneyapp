'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2 font-medium
      transition-all duration-200 ease-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variants = {
      primary: `
        bg-[var(--color-primary)] text-white
        hover:bg-[var(--color-primary-dark)]
        focus-visible:ring-[var(--color-primary)]
        shadow-[var(--shadow-sm)]
      `,
      secondary: `
        bg-[var(--color-surface-raised)] text-[var(--color-text)]
        border border-[var(--color-border)]
        hover:bg-[var(--color-surface-sunken)] hover:border-[var(--color-border-strong)]
        focus-visible:ring-[var(--color-primary)]
      `,
      ghost: `
        bg-transparent text-[var(--color-text-muted)]
        hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]
        focus-visible:ring-[var(--color-primary)]
      `,
      danger: `
        bg-[var(--color-danger)] text-white
        hover:opacity-90
        focus-visible:ring-[var(--color-danger)]
      `,
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm rounded-[var(--radius-sm)]',
      md: 'h-10 px-4 text-sm rounded-[var(--radius-md)]',
      lg: 'h-12 px-6 text-base rounded-[var(--radius-md)]',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
