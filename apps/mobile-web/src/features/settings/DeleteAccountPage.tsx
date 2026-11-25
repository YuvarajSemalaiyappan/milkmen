import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { useAuthStore, useAppStore } from '@/store'
import { accountApi, type DeletionRequestInfo } from '@/services/api'
import { formatDate } from '@/utils/format'
import { SUPPORT_EMAIL } from '@/utils/contact'

// Settings -> Delete account. Sends a request; the admin deletes the data (within 30 days).
// Same screen in the phone app (settings/delete-account.tsx).
export function DeleteAccountPage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const addToast = useAppStore((state) => state.addToast)
  const isOwner = user?.role === 'OWNER'

  const [request, setRequest] = useState<DeletionRequestInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    accountApi.getDeletionRequest()
      .then((r) => setRequest(r.data))
      .catch((err) => addToast({ type: 'error', message: err instanceof Error ? err.message : t('common.error') }))
      .finally(() => setIsLoading(false))
  }, [addToast, t])

  const send = async () => {
    if (!confirm(t('account.confirm'))) return
    setIsSaving(true)
    try {
      const r = await accountApi.requestDeletion(reason.trim() || undefined)
      setRequest(r.data)
      setReason('')
      addToast({ type: 'success', message: t('account.sent') })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : t('common.error') })
    } finally {
      setIsSaving(false)
    }
  }

  const withdraw = async () => {
    if (!confirm(t('account.withdrawConfirm'))) return
    setIsSaving(true)
    try {
      await accountApi.withdrawDeletion()
      setRequest(null)
      addToast({ type: 'success', message: t('account.withdrawn') })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : t('common.error') })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell title={t('account.deleteTitle')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : request ? (
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">{t('account.pendingTitle')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              {t('account.pending', { date: formatDate(request.createdAt) })}
            </p>
            <Button variant="outline" className="mt-4" fullWidth isLoading={isSaving} onClick={withdraw}>
              {t('account.withdraw')}
            </Button>
          </Card>
        ) : (
          <Card>
            <p className="text-gray-600 dark:text-gray-300">{t('account.deleteIntro')}</p>
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">
                {isOwner ? t('account.whatOwner') : t('account.whatStaff')}
              </p>
            </div>
            {isOwner && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('account.exportHint')}</p>
            )}
            <p className="mt-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">{t('account.reasonLabel')}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
            <Button variant="danger" className="mt-4" fullWidth isLoading={isSaving} onClick={send}>
              {t('account.send')}
            </Button>
          </Card>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t('account.contact', { email: SUPPORT_EMAIL })}
        </p>
        <p className="text-center text-sm">
          <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">{t('account.privacy')}</Link>
        </p>
      </div>
    </AppShell>
  )
}
