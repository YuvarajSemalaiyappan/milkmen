import { useState } from 'react'
import { clsx } from 'clsx'
import { Delete, Hash, Grid3X3 } from 'lucide-react'

export interface QuickPadProps {
  value: string
  onChange: (value: string) => void
  defaultFullPad?: boolean
  className?: string
}

export function QuickPad({ value, onChange, defaultFullPad = false, className }: QuickPadProps) {
  const [showFullPad, setShowFullPad] = useState(defaultFullPad)

  const currentValue = parseFloat(value) || 0

  const handleQuickAdd = (amount: number) => {
    const newValue = currentValue + amount
    // Round to 2 decimal places to avoid floating point issues
    const rounded = Math.round(newValue * 100) / 100
    onChange(rounded.toString())
  }

  const handleClear = () => {
    onChange('')
  }

  if (showFullPad) {
    return (
      <div className={className}>
        <NumberPad
          value={value}
          onChange={onChange}
          maxLength={6}
          allowDecimal
          decimalPlaces={2}
        />
        <button
          type="button"
          onClick={() => setShowFullPad(false)}
          className="mt-2 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl font-medium text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500 transition-colors"
        >
          <Grid3X3 className="w-4 h-4" />
          Quick Pad
        </button>
      </div>
    )
  }

  const quickKeys = [
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '.25', value: 0.25 },
    { label: '.50', value: 0.50 },
    { label: '.75', value: 0.75 },
  ]

  return (
    <div className={clsx('grid grid-cols-3 gap-2', className)}>
      {quickKeys.map((key) => (
        <button
          key={key.label}
          type="button"
          onClick={() => handleQuickAdd(key.value)}
          className="flex items-center justify-center min-h-[56px] rounded-xl font-semibold text-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600 active:scale-95 transform transition-colors duration-150"
        >
          {key.label}
        </button>
      ))}
      {/* Clear */}
      <button
        type="button"
        onClick={handleClear}
        className="flex items-center justify-center min-h-[56px] rounded-xl font-semibold text-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 active:bg-red-200 dark:active:bg-red-900/70 active:scale-95 transform transition-colors duration-150"
      >
        C
      </button>
      {/* 123 toggle */}
      <button
        type="button"
        onClick={() => setShowFullPad(true)}
        className="flex items-center justify-center gap-1.5 min-h-[56px] rounded-xl font-semibold text-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 active:bg-blue-200 dark:active:bg-blue-900/70 active:scale-95 transform transition-colors duration-150"
      >
        <Hash className="w-5 h-5" />
        123
      </button>
    </div>
  )
}

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
