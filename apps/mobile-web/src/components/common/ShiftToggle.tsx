import { clsx } from 'clsx'
import { Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Shift } from '@/types'

export interface ShiftToggleProps {
  value: Shift
  onChange: (shift: Shift) => void
  size?: 'sm' | 'md' | 'lg'
  showIcons?: boolean
  fullWidth?: boolean
}

export function ShiftToggle({
  value,
  onChange,
  size = 'md',
  showIcons = true,
  fullWidth = false
}: ShiftToggleProps) {
  const { t } = useTranslation()

  const sizeStyles = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-base',
    lg: 'h-14 text-lg'
  }

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div
      className={clsx(
        'inline-flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1',
        fullWidth && 'w-full'
      )}
    >
      <button
        type="button"
        onClick={() => onChange('MORNING')}
        className={clsx(
          'flex-1 flex items-center justify-center gap-2 rounded-md px-4 font-medium',
          'transition-all duration-200',
          sizeStyles[size],
          value === 'MORNING'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        )}
      >
        {showIcons && <Sun className={iconSize[size]} />}
        <span>{t('shifts.morning')}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('EVENING')}
        className={clsx(
          'flex-1 flex items-center justify-center gap-2 rounded-md px-4 font-medium',
          'transition-all duration-200',
          sizeStyles[size],
          value === 'EVENING'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        )}
      >
        {showIcons && <Moon className={iconSize[size]} />}
        <span>{t('shifts.evening')}</span>
      </button>
    </div>
  )
}
