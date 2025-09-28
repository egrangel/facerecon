import React, { forwardRef } from 'react';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({
    name,
    options,
    value,
    defaultValue,
    onChange,
    label,
    description,
    error,
    disabled = false,
    orientation = 'vertical',
    className = '',
  }, ref) => {
    const handleChange = (optionValue: string) => {
      if (onChange && !disabled) {
        onChange(optionValue);
      }
    };

    return (
      <div ref={ref} className={className}>
        {label && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              {label}
            </label>
            {description && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {description}
              </p>
            )}
          </div>
        )}

        <div className={`
          ${orientation === 'horizontal' ? 'flex flex-wrap gap-6' : 'space-y-3'}
        `}>
          {options.map((option) => {
            const radioId = `${name}-${option.value}`;
            const isChecked = value ? value === option.value : defaultValue === option.value;
            const isDisabled = disabled || option.disabled;

            return (
              <div key={option.value} className="flex items-start space-x-3">
                <div className="relative flex items-center justify-center">
                  <input
                    type="radio"
                    id={radioId}
                    name={name}
                    value={option.value}
                    checked={isChecked}
                    onChange={() => handleChange(option.value)}
                    disabled={isDisabled}
                    className={`
                      h-4 w-4
                      text-[var(--color-primary-500)]
                      bg-[var(--color-background-primary)]
                      border-2 border-[var(--color-border-medium)]
                      focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-opacity-50
                      focus:border-[var(--color-primary-500)]
                      hover:border-[var(--color-primary-400)]
                      checked:bg-[var(--color-primary-500)]
                      checked:border-[var(--color-primary-500)]
                      disabled:bg-[var(--color-background-tertiary)]
                      disabled:border-[var(--color-border-light)]
                      disabled:cursor-not-allowed
                      transition-colors duration-200
                    `}
                  />
                  {/* Custom radio dot */}
                  {isChecked && (
                    <div className="absolute h-2 w-2 bg-[var(--color-text-inverse)] rounded-full pointer-events-none" />
                  )}
                </div>

                <div className="flex-1">
                  <label
                    htmlFor={radioId}
                    className={`
                      text-sm font-medium text-[var(--color-text-primary)]
                      cursor-pointer select-none
                      ${isDisabled ? 'text-[var(--color-text-muted)] cursor-not-allowed' : ''}
                    `}
                  >
                    {option.label}
                  </label>
                  {option.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-[var(--color-status-error-text)] mt-2">
            {error}
          </p>
        )}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export default RadioGroup;