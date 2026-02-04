import { type HTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({
  children,
  className,
  padding = 'md',
  shadow = 'sm',
  ...props
}: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }

  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  }

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700',
        paddingStyles[padding],
        shadowStyles[shadow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={clsx('flex items-start justify-between mb-4', className)}
      {...props}
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray'
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue'
}: StatCardProps) {
  const iconBgStyles = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600',
    green: 'bg-gradient-to-br from-green-50 to-green-100 text-green-600',
    yellow: 'bg-gradient-to-br from-yellow-50 to-yellow-100 text-yellow-600',
    red: 'bg-gradient-to-br from-red-50 to-red-100 text-red-600',
    gray: 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-600'
  }

  const borderStyles = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red: 'border-l-red-500',
    gray: 'border-l-gray-500'
  }

  return (
    <Card className={clsx('flex items-start gap-4 border-l-4', borderStyles[color])}>
      {icon && (
        <div
          className={clsx(
            'p-3 rounded-xl flex-shrink-0',
            iconBgStyles[color]
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {subtitle && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
            )}
            {trend && (
              <span
                className={clsx(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
