import { Check } from 'lucide-react'
import { LANGUAGES, type Language } from '@/i18n/languages'

// The 12 app languages as a grid of choices, each named in its own script (same as the phone app).
export function LanguagePicker({ value, onChange }: { value: string; onChange: (lng: Language) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={value === code}
          onClick={() => onChange(code)}
          className={`py-3 px-2 rounded-lg border-2 font-medium transition-colors ${
            value === code
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            {value === code && <Check className="w-4 h-4 shrink-0" />}
            {label}
          </div>
        </button>
      ))}
    </div>
  )
}
