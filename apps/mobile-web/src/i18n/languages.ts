// The app's languages, with their names in their own script. No imports, so any file can use it.
// Languages other than English and Tamil were machine-translated and need a native speaker's review.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'mr', label: 'मराठी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'as', label: 'অসমীয়া' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export function isLanguage(v: string | null | undefined): v is Language {
  return LANGUAGES.some((l) => l.code === v)
}

/** Locale for dates and numbers, e.g. 'te-IN'. Unknown languages fall back to 'en-IN'. */
export function localeOf(lng: string | undefined): string {
  return `${isLanguage(lng) ? lng : 'en'}-IN`
}
