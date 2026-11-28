import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n/languages'
import { CheckCircle, Milk } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { accountApi } from '@/services/api'
import { SUPPORT_EMAIL } from '@/utils/contact'

// Public page at /delete-account (no sign-in): Google Play needs a web page where people can ask
// for their account to be deleted without the app. Sends a request; the admin checks the phone
// number with the person and deletes the data.
export function PublicDeleteAccountPage() {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/[\s-]/g, '')
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = t('account.nameRequired')
    if (!/^\+?\d{10,15}$/.test(digits)) next.phone = t('account.invalidPhone')
    setErrors(next)
    if (next.name || next.phone) return

    setIsSaving(true)
    try {
      await accountApi.requestDeletionPublic({
        name: name.trim(),
        phone: digits,
        businessName: businessName.trim() || undefined,
        reason: reason.trim() || undefined
      })
      setSent(true)
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : t('common.error') })
    } finally {
      setIsSaving(false)
    }
  }

  const lang = (code: string, label: string) => (
    <button
      key={code}
      type="button"
      onClick={() => i18n.changeLanguage(code)}
      className={`px-3 py-1 rounded-full text-sm ${i18n.language === code
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md mx-auto px-5 py-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Milk className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-w-[75%]">
            {LANGUAGES.map(({ code, label }) => lang(code, label))}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('account.publicTitle')}</h1>

        {sent ? (
          <Card className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-200">{t('account.publicSent')}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-gray-600 dark:text-gray-300">{t('account.publicIntro')}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('account.publicSignedIn')}</p>
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300 space-y-1">
              <p>{t('account.whatOwner')}</p>
              <p>{t('account.whatStaff')}</p>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
              <Input label={t('account.name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} />
              <Input
                label={t('account.phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
                inputMode="tel"
                maxLength={16}
              />
              <Input label={t('account.businessName')} value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={100} />
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{t('account.reasonLabel')}</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                />
              </div>
              {errors.form && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{errors.form}</div>}
              <Button type="submit" variant="danger" fullWidth isLoading={isSaving}>{t('account.send')}</Button>
            </form>
          </Card>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('account.contact', { email: SUPPORT_EMAIL })}</p>
        <div className="flex justify-center gap-4 text-sm">
          <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">{t('account.privacy')}</Link>
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">{t('account.backToLogin')}</Link>
        </div>
      </div>
    </div>
  )
}
