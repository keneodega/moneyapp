'use client';

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-small font-medium text-[var(--color-text)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            min-h-[44px] px-3 rounded-[var(--radius-md)]
            bg-[var(--color-surface-raised)]
            border border-[var(--color-border)]
            text-[var(--color-text)] text-body
            placeholder:text-[var(--color-text-subtle)]
            transition-colors duration-200
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <span className="text-caption text-[var(--color-text-subtle)]">{hint}</span>
        )}
        {error && (
          <span className="text-caption text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, hint, id, options, placeholder, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-small font-medium text-[var(--color-text)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            min-h-[44px] px-3 rounded-[var(--radius-md)]
            bg-[var(--color-surface-raised)]
            border border-[var(--color-border)]
            text-[var(--color-text)] text-body
            transition-colors duration-200
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer
            ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <span className="text-caption text-[var(--color-text-subtle)]">{hint}</span>
        )}
        {error && (
          <span className="text-caption text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-small font-medium text-[var(--color-text)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            min-h-[100px] p-3 rounded-[var(--radius-md)]
            bg-[var(--color-surface-raised)]
            border border-[var(--color-border)]
            text-[var(--color-text)] text-body
            placeholder:text-[var(--color-text-subtle)]
            transition-colors duration-200
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-vertical
            ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <span className="text-caption text-[var(--color-text-subtle)]">{hint}</span>
        )}
        {error && (
          <span className="text-caption text-[var(--color-danger)]">{error}</span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
