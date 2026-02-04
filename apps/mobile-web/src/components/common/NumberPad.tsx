import { clsx } from 'clsx'
import { Delete } from 'lucide-react'

export interface NumberPadProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  maxLength?: number
  allowDecimal?: boolean
  decimalPlaces?: number
  className?: string
}

export function NumberPad({
  value,
  onChange,
  onSubmit,
  maxLength = 10,
  allowDecimal = true,
  decimalPlaces = 2,
  className
}: NumberPadProps) {
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1))
      return
    }

    if (key === 'clear') {
      onChange('')
      return
    }

    if (key === 'submit') {
      onSubmit?.()
      return
    }

    // Handle decimal point
    if (key === '.') {
      if (!allowDecimal) return
      if (value.includes('.')) return
      if (value === '') {
        onChange('0.')
        return
      }
      if (value.length >= maxLength) return
      onChange(value + '.')
      return
    }

    // Handle number keys
    if (value.length >= maxLength) return

    // Check decimal places limit
    if (value.includes('.')) {
      const parts = value.split('.')
      if (parts[1] && parts[1].length >= decimalPlaces) return
    }

    // Prevent leading zeros (except for decimals)
    if (value === '0' && key !== '.') {
      onChange(key)
      return
    }

    onChange(value + key)
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [allowDecimal ? '.' : 'clear', '0', 'backspace']
  ]

  return (
    <div className={clsx('grid grid-cols-3 gap-2', className)}>
      {keys.flat().map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleKeyPress(key)}
          className={clsx(
            'flex items-center justify-center',
            'min-h-[56px] rounded-xl font-semibold text-xl',
            'transition-colors duration-150',
            'active:scale-95 transform',
            key === 'backspace'
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500'
              : key === 'clear'
              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 active:bg-red-200 dark:active:bg-red-900/70'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600'
          )}
        >
          {key === 'backspace' ? (
            <Delete className="w-6 h-6" />
          ) : key === 'clear' ? (
            'C'
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  )
}

export interface PinPadProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (pin: string) => void
  length?: number
  className?: string
}

export function PinPad({
  value,
  onChange,
  onComplete,
  length = 4,
  className
}: PinPadProps) {
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1))
      return
    }

    if (value.length >= length) return

    const newValue = value + key
    onChange(newValue)

    if (newValue.length === length) {
      onComplete?.(newValue)
    }
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'backspace']
  ]

  return (
    <div className={clsx('space-y-4', className)}>
      {/* PIN dots display */}
      <div className="flex justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'w-4 h-4 rounded-full transition-all duration-200',
              i < value.length ? 'bg-blue-600 dark:bg-blue-500 scale-110' : 'bg-gray-300 dark:bg-gray-600'
            )}
          />
        ))}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.flat().map((key, index) => (
          <button
            key={index}
            type="button"
            onClick={() => key && handleKeyPress(key)}
            disabled={!key}
            className={clsx(
              'flex items-center justify-center',
              'min-h-[64px] rounded-xl font-semibold text-2xl',
              'transition-all duration-150',
              'active:scale-95 transform',
              !key
                ? 'invisible'
                : key === 'backspace'
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-200 dark:active:bg-gray-600'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white active:bg-gray-50 dark:active:bg-gray-700'
            )}
          >
            {key === 'backspace' ? (
              <Delete className="w-6 h-6" />
            ) : (
              key
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
