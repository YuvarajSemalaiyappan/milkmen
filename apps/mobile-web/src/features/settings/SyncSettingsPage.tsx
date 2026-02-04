import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Cloud, CloudOff, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Badge } from '@/components/ui'
import { useSyncStore, selectSyncStatus, selectSyncProgress } from '@/store'
import { syncService } from '@/services/syncService'
import { db } from '@/db/localDb'
import { formatDate } from '@/utils'

export function SyncSettingsPage() {
  const { t } = useTranslation()
  const syncStore = useSyncStore()
  const syncStatus = useSyncStore(selectSyncStatus)
  const syncProgress = useSyncStore(selectSyncProgress)

  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleManualSync = async () => {
    setError('')
    setSuccess('')
    try {
      await syncService.sync()
      setSuccess(t('settings.syncComplete'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.syncFailed'))
    }
  }

  const handleClearCache = async () => {
    if (!confirm(t('settings.clearDataConfirm'))) return

    setIsClearing(true)
    setError('')
    setSuccess('')
    try {
      // Clear all local tables
      await db.transaction('rw', [db.farmers, db.customers, db.collections, db.deliveries, db.payments, db.syncQueue], async () => {
        await db.farmers.clear()
        await db.customers.clear()
        await db.collections.clear()
        await db.deliveries.clear()
        await db.payments.clear()
        await db.syncQueue.clear()
      })

      // Reset sync store
      syncStore.setPendingCount(0)
      syncStore.setFailedCount(0)

      setSuccess(t('settings.cacheCleared'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsClearing(false)
    }
  }

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
      case 'synced':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-600" />
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-600" />
      default:
        return <Cloud className="w-6 h-6 text-gray-600" />
    }
  }

  const getStatusLabel = () => {
    switch (syncStatus) {
      case 'syncing':
        return t('common.syncing')
      case 'synced':
        return t('common.synced')
      case 'failed':
        return t('common.syncFailed')
      case 'pending':
        return t('settings.pendingSync')
      default:
        return t('settings.unknown')
    }
  }

  const getStatusBadgeVariant = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'info' as const
      case 'synced':
        return 'success' as const
      case 'failed':
        return 'error' as const
      case 'pending':
        return 'warning' as const
      default:
        return 'default' as const
    }
  }

  return (
    <AppShell title={t('settings.sync')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Sync Status */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('settings.syncStatus')}</h3>
            <Badge variant={getStatusBadgeVariant()}>
              {getStatusLabel()}
            </Badge>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            {getStatusIcon()}
            <div className="flex-1">
              {syncStatus === 'syncing' ? (
                <>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {t('settings.syncingData')}
                  </p>
                  {syncStore.currentTable && (
                    <p className="text-sm text-gray-500">
                      {t('settings.syncing')} {syncStore.currentTable}... {syncProgress}%
                    </p>
                  )}
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {syncStatus === 'synced' ? t('settings.allSynced') :
                     syncStatus === 'pending' ? t('settings.changesPending') :
                     syncStatus === 'failed' ? t('settings.syncHasFailed') :
                     t('settings.readyToSync')}
                  </p>
                  {syncStore.lastSyncAt && (
                    <p className="text-sm text-gray-500">
                      {t('settings.lastSync')}: {formatDate(new Date(syncStore.lastSyncAt).toISOString())}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Pending/Failed Counts */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={syncStore.pendingCount > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('settings.pendingChanges')}</p>
              <p className={`text-3xl font-bold ${syncStore.pendingCount > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                {syncStore.pendingCount}
              </p>
            </div>
          </Card>
          <Card className={syncStore.failedCount > 0 ? 'border-red-200 bg-red-50' : ''}>
            <div className="text-center">
              <p className="text-sm text-gray-500">{t('settings.failedSync')}</p>
              <p className={`text-3xl font-bold ${syncStore.failedCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {syncStore.failedCount}
              </p>
            </div>
          </Card>
        </div>

        {/* Manual Sync Button */}
        <Button
          className="w-full"
          onClick={handleManualSync}
          disabled={syncStatus === 'syncing'}
          leftIcon={<RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />}
        >
          {syncStatus === 'syncing' ? t('common.syncing') : t('settings.syncNow')}
        </Button>

        {/* Last Error */}
        {syncStore.lastError && (
          <Card className="border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">{t('settings.lastError')}</h4>
                <p className="text-sm text-red-600 mt-1">{syncStore.lastError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => syncStore.clearError()}
                >
                  {t('settings.dismissError')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Offline Mode Info */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">{t('settings.offlineMode')}</h4>
              <p className="text-sm text-blue-700 mt-1">
                {t('settings.offlineModeDescription')}
              </p>
            </div>
          </div>
        </Card>

        {/* Clear Cache */}
        <Card className="border-red-100">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">{t('settings.clearData')}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.clearDataDescription')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleClearCache}
                disabled={isClearing}
              >
                {isClearing ? t('common.loading') : t('settings.clearData')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
