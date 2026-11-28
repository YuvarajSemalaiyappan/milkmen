import { z } from 'zod'

// The app languages, same codes as src/i18n/languages.ts in both apps.
export const LANGUAGE_CODES = ['en', 'ta', 'hi', 'bn', 'mr', 'te', 'gu', 'kn', 'ml', 'or', 'pa', 'as'] as const

export const LANGUAGE_NAMES: Record<(typeof LANGUAGE_CODES)[number], string> = {
  en: 'English', ta: 'Tamil', hi: 'Hindi', bn: 'Bengali', mr: 'Marathi', te: 'Telugu',
  gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', or: 'Odia', pa: 'Punjabi', as: 'Assamese'
}

export const languageSchema = z.enum(LANGUAGE_CODES)
