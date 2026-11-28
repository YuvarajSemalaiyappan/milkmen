import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import as from './locales/as.json'
import bn from './locales/bn.json'
import en from './locales/en.json'
import gu from './locales/gu.json'
import hi from './locales/hi.json'
import kn from './locales/kn.json'
import ml from './locales/ml.json'
import mr from './locales/mr.json'
import or from './locales/or.json'
import pa from './locales/pa.json'
import ta from './locales/ta.json'
import te from './locales/te.json'
import { isLanguage } from './languages'

export { LANGUAGES, localeOf, type Language } from './languages'

// Get saved language or default to English
const stored = typeof window !== 'undefined' ? localStorage.getItem('milkmen_language') : null
const savedLanguage = isLanguage(stored) ? stored : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
      hi: { translation: hi },
      bn: { translation: bn },
      mr: { translation: mr },
      te: { translation: te },
      gu: { translation: gu },
      kn: { translation: kn },
      ml: { translation: ml },
      or: { translation: or },
      pa: { translation: pa },
      as: { translation: as }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  })

// Save language preference when changed
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('milkmen_language', lng)
  }
})

export default i18n
