import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

/** A small spinner with a word beside it, for work that has no button of its own (e.g. after the PIN is typed). */
export function InlineLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={clsx('flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400', className)}>
      <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
      {label ? <span>{label}</span> : null}
    </div>
  )
}
