// App language codes (same as src/i18n/languages.ts in the apps and server/src/lib/languages.ts), in English for the admin.
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
  gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', or: 'Odia', pa: 'Punjabi', as: 'Assamese'
}

/** "Not known" = the user hasn't opened an app version that reports its language yet. */
export const languageName = (code: string | null | undefined) => (code ? LANGUAGE_NAMES[code] ?? code : 'Not known')
