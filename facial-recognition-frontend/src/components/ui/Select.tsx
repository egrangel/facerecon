import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({
    className = '',
    label,
    description,
    error,
    options,
    placeholder,
    size = 'md',
    ...props
  }, ref) => {
    const selectId = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;

    const sizeClasses = {
      sm: 'h-8 text-sm px-3 py-1',
      md: 'h-10 text-sm px-3 py-2',
      lg: 'h-12 text-base px-4 py-3',
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
          >
            {label}
          </label>
        )}

        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            {description}
          </p>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full
              ${sizeClasses[size]}
              bg-[var(--color-background-secondary)]
              border-2 border-[var(--color-border-medium)]
              rounded-[var(--border-radius-md)]
              text-[var(--color-text-primary)]
              shadow-[var(--shadow-sm)]
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-primary-500)]
              focus:ring-opacity-50
              focus:border-[var(--color-primary-500)]
              hover:border-[var(--color-border-dark)]
              disabled:bg-[var(--color-background-tertiary)]
              disabled:text-[var(--color-text-muted)]
              disabled:border-[var(--color-border-light)]
              disabled:cursor-not-allowed
              transition-all duration-200
              appearance-none
              pr-10
              ${error ? 'border-[var(--color-status-error-border)]' : ''}
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
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]"
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="h-5 w-5 text-[var(--color-text-tertiary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {error && (
          <p className="text-xs text-[var(--color-status-error-text)] mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;