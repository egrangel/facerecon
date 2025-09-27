import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, ...props }, ref) => {
    const inputId = props.id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--color-text-primary)] mb-1"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          className={clsx(
            `flex h-10 w-full rounded-[var(--border-radius-md)] border border-[var(--color-border-medium)]
             bg-[var(--color-background-secondary)] px-3 py-2 text-[var(--font-size-sm)]
             text-[var(--color-text-primary)] font-family-[var(--font-family-sans)]
             placeholder:text-[var(--color-text-muted)] transition-all duration-200
             focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]
             focus:border-[var(--color-primary-500)] shadow-[var(--shadow-sm)]
             disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-background-tertiary)]`,
            error && 'border-[var(--color-status-error-border)] focus:ring-[var(--color-status-error-border)]',
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && !error && (
          <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            {helperText}
          </p>
        )}
        {error && (
          <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-status-error-text)]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;