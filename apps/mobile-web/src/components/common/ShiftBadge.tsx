import { Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Shift } from '@/types'

// The AM / PM badge used on every entry list, so morning and evening look the same everywhere
// (same badge as the phone app).
export function ShiftBadge({ shift, label }: { shift: Shift; label?: string }) {
  const { t } = useTranslation()
  const morning = shift === 'MORNING'
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
        morning
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
      }`}
    >
      {morning ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
      {label ?? (morning ? t('shifts.am') : t('shifts.pm'))}
    </span>
  )
}
