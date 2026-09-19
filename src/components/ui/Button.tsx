import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'approve' | 'reject'

const VARIANTS: Record<Variant, string> = {
  primary: 'border-transparent bg-blue text-white hover:brightness-110',
  secondary: 'border-border-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border-red-line bg-red-tint text-red hover:brightness-95',
  // Approve affirms a proposal; reject dismisses one. Dismissal is a normal research
  // decision, so it stays neutral rather than taking a warning colour.
  approve: 'border-teal-line bg-teal-tint text-teal hover:brightness-95',
  reject: 'border-border-strong bg-surface text-ink-muted hover:bg-surface-2',
}

type Size = 'sm' | 'md'

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[11px] gap-1.5',
  md: 'h-8 px-3 text-[12px] gap-1.5',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
      {children}
    </button>
  )
}
