import React, { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, description, error, ...props }, ref) => {
    const checkboxId = props.id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-start space-x-3">
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={`
              h-4 w-4
              text-[var(--color-primary-500)]
              bg-[var(--color-background-primary)]
              border-2 border-[var(--color-border-medium)]
              rounded
              focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-opacity-50
              focus:border-[var(--color-primary-500)]
              hover:border-[var(--color-primary-400)]
              checked:bg-[var(--color-primary-500)]
              checked:border-[var(--color-primary-500)]
              disabled:bg-[var(--color-background-tertiary)]
              disabled:border-[var(--color-border-light)]
              disabled:cursor-not-allowed
              transition-colors duration-200
              ${className}
            `}
            {...props}
          />
          {/* Custom checkmark icon */}
          {props.checked && (
            <svg
              className="absolute h-3 w-3 text-[var(--color-text-inverse)] pointer-events-none"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label
                htmlFor={checkboxId}
                className={`
                  text-sm font-medium text-[var(--color-text-primary)]
                  cursor-pointer select-none
                  ${props.disabled ? 'text-[var(--color-text-muted)] cursor-not-allowed' : ''}
                `}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {description}
              </p>
            )}
            {error && (
              <p className="text-xs text-[var(--color-status-error-text)] mt-1">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;