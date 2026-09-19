import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const FIELD_BASE =
  'rounded border border-border-strong bg-surface px-2 text-[12px] text-ink transition-colors placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-50'

interface FieldProps {
  label: ReactNode
  /** Rendered to the right of the label, e.g. a range hint. */
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, htmlFor, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint"
      >
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-ink-faint">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** Applied to the input; use font-mono for numeric and ID fields. */
  mono?: boolean
}

export function Input({ invalid = false, mono = false, className = '', ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`h-8 ${FIELD_BASE} ${mono ? 'tnum font-mono' : ''} ${
        invalid ? 'border-red' : 'focus:border-blue'
      } ${className}`}
      {...rest}
    />
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ children, className = '', ...rest }: SelectProps) {
  return (
    <select className={`h-8 ${FIELD_BASE} pr-6 focus:border-blue ${className}`} {...rest}>
      {children}
    </select>
  )
}

export interface ToggleOption<T extends string> {
  value: T
  label: ReactNode
  /** Classes for the selected button — used to tint Agentic/Static mode pickers. */
  activeClassName?: string
}

interface ToggleGroupProps<T extends string> {
  value: T
  options: ToggleOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  disabled?: boolean
}

/** Segmented control. Used for run mode, view mode and small binary filters. */
export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: ToggleGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded border border-border-strong bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`h-6 rounded-sm px-2.5 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? `bg-surface text-ink shadow-sm ${option.activeClassName ?? ''}`
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
