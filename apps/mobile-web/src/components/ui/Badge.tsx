import { type HTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
    success: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
    error: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
  }

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export interface BalanceChipProps {
  amount: number
  type: 'positive' | 'negative' | 'neutral'
  showSign?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function BalanceChip({
  amount,
  type,
  showSign = true,
  size = 'md'
}: BalanceChipProps) {
  const typeStyles = {
    positive: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    negative: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    neutral: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
  }

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  const formatAmount = (val: number) => {
    const formatted = Math.abs(val).toLocaleString('en-IN')
    if (!showSign) return `₹${formatted}`
    if (type === 'positive') return `+₹${formatted}`
    if (type === 'negative') return `-₹${formatted}`
    return `₹${formatted}`
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold rounded-full',
        typeStyles[type],
        sizeStyles[size]
      )}
    >
      {formatAmount(amount)}
    </span>
  )
}
