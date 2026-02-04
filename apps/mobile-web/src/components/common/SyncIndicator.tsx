import { clsx } from 'clsx'
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore, useSyncStore, selectSyncStatus } from '@/store'

export interface SyncIndicatorProps {
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function SyncIndicator({ showLabel = true, size = 'sm' }: SyncIndicatorProps) {
  const { t } = useTranslation()
  const isOnline = useAppStore((state) => state.isOnline)
  const syncStatus = useSyncStore(selectSyncStatus)
  const pendingCount = useSyncStore((state) => state.pendingCount)

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-yellow-600">
        <CloudOff className={iconSize} />
        {showLabel && <span className={textSize}>{t('common.offline')}</span>}
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-blue-600">
        <RefreshCw className={clsx(iconSize, 'animate-spin')} />
        {showLabel && <span className={textSize}>{t('common.syncing')}</span>}
      </div>
    )
  }

  if (syncStatus === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <AlertCircle className={iconSize} />
        {showLabel && <span className={textSize}>{t('common.syncFailed')}</span>}
      </div>
    )
  }

  if (syncStatus === 'pending' && pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-yellow-600">
        <Cloud className={iconSize} />
        {showLabel && (
          <span className={textSize}>
            {pendingCount} {t('common.syncing').toLowerCase()}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-green-600">
      <Cloud className={iconSize} />
      {showLabel && <span className={textSize}>{t('common.synced')}</span>}
    </div>
  )
}
