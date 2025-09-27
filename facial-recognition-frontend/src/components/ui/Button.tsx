import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center font-medium transition-all duration-200
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]
      focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none
      font-[var(--font-weight-medium)]
    `;

    const variants = {
      primary: `
        bg-[var(--color-primary-500)] text-[var(--color-text-inverse)]
        hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)]
        border border-[var(--color-primary-500)] hover:border-[var(--color-primary-600)]
        shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]
      `,
      secondary: `
        bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]
        hover:bg-[var(--color-secondary-200)] active:bg-[var(--color-secondary-300)]
        border border-[var(--color-secondary-200)] hover:border-[var(--color-secondary-300)]
      `,
      outline: `
        border border-[var(--color-border-medium)] bg-[var(--color-background-secondary)]
        text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]
        active:bg-[var(--color-secondary-100)] hover:border-[var(--color-border-dark)]
      `,
      ghost: `
        text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)]
        active:bg-[var(--color-secondary-100)] border border-transparent
      `,
      danger: `
        bg-[var(--color-status-error-border)] text-[var(--color-text-inverse)]
        hover:bg-red-700 active:bg-red-800 border border-[var(--color-status-error-border)]
        shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]
      `
    };

    const sizes = {
      sm: 'h-9 px-3 text-[var(--font-size-sm)] rounded-[var(--border-radius-sm)]',
      md: 'h-10 py-2 px-4 text-[var(--font-size-base)] rounded-[var(--border-radius-md)]',
      lg: 'h-11 px-8 text-[var(--font-size-lg)] rounded-[var(--border-radius-lg)]'
    };

    return (
      <button
        className={clsx(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;