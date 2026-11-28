import i18n from '@/i18n'
import { isLanguage, type Language } from '@/i18n/languages'
import { api } from '@/services/api'
import { useAuthStore } from '@/store'

// The user's language is saved on the server too (User.language), so it follows the account to the phone
// app and other browsers, and the admin can see which languages are in use. Same rules as the phone app's
// lib/language.ts. Saving there is best effort: the language still changes here if the server can't be reached.

let pickedBeforeLogin = false

function report(lng: string) {
  if (!useAuthStore.getState().token || !isLanguage(lng)) return
  api.put('/settings/language', { language: lng }).catch(() => {})
}

/** Language chosen in the app (login/register screens, Settings). */
export function chooseLanguage(lng: Language) {
  i18n.changeLanguage(lng)
  if (useAuthStore.getState().token) report(lng)
  else pickedBeforeLogin = true
}

/** After logging in: the account's saved language wins, unless the user just picked one before logging in. */
export function languageAfterLogin(language: string | null | undefined) {
  if (!pickedBeforeLogin && isLanguage(language)) i18n.changeLanguage(language)
  else report(i18n.language)
  pickedBeforeLogin = false
}

/** Once per page load while signed in, so accounts made before languages were saved report theirs. */
let reported = false
export function reportLanguageOnce() {
  if (reported) return
  reported = true
  report(i18n.language)
}
