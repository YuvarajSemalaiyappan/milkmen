import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Link2, Loader2 } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { orderShareApi } from '@/services/api'
import type { ApiResponse, OrderFollow } from '@/types'

// Sharing the collect/deliver order (both shifts) between users, on the Collect and Deliver pages:
//   Follow someone's order: live and read-only (the list can't be dragged; their changes show).
//   Stop following: keeps a copy of the order as this user's own.
//   Copy someone's order: a one-time copy that this user can change.
// The server keeps the rules (server lib/order-follow.ts). Same as the phone app's OrderShare.
// `onChanged` reloads the page's order (useSortOrder().reload).
export function OrderShare({ kind, onChanged }: { kind: 'farmer' | 'customer'; onChanged: () => void }) {
  const { t } = useTranslation()
  const [data, setData] = useState<OrderFollow | null>(null)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<null | 'follow' | 'copy' | 'stop'>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    orderShareApi
      .get(kind)
      .then((r) => {
        if (!cancelled) setData((r as ApiResponse<OrderFollow>).data ?? null)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [kind, version])

  const run = async (what: 'follow' | 'copy' | 'stop', fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(what)
    setError('')
    try {
      await fn()
      setVersion((v) => v + 1)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  if (!data) return null
  const nameOf = (id: string) => data.users.find((u) => u.id === id)?.name ?? ''

  if (data.following) {
    const name = data.following.name
    return (
      <Card className="border border-blue-300 dark:border-blue-700 space-y-2">
        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t('order.following', { name })}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('order.followingHint', { name })}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button variant="outline" size="sm" fullWidth isLoading={busy === 'stop'} disabled={!!busy} onClick={() => run('stop', () => orderShareApi.follow(kind, null))}>
          {t('order.stopFollowing')}
        </Button>
      </Card>
    )
  }

  const select = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
        <Link2 className="w-4 h-4" />
        {t('order.share')}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {data.followers.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t('order.followers', { names: data.followers.map((f) => f.name).join(', ') })}</p>
      )}
      {open && (
        <Card className="space-y-3">
          {data.users.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('order.noOthers')}</p>
          ) : (
            <>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400">{t('order.follow')}</label>
                <div className="flex items-center gap-2">
                  <select
                    className={select}
                    value=""
                    disabled={!!busy}
                    onChange={(e) => {
                      const id = e.target.value
                      if (id && confirm(t('order.followConfirm', { name: nameOf(id) }))) run('follow', () => orderShareApi.follow(kind, id))
                    }}
                  >
                    <option value="">{t('order.follow')}</option>
                    {data.users.map((u) => <option key={u.id} value={u.id}>{u.name} · …{u.phoneEnd}</option>)}
                  </select>
                  {busy === 'follow' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('order.followHint')}</p>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400">{t('order.copyFrom')}</label>
                <div className="flex items-center gap-2">
                  <select
                    className={select}
                    value=""
                    disabled={!!busy}
                    onChange={(e) => {
                      const id = e.target.value
                      if (id && confirm(t('order.copyConfirm', { name: nameOf(id) }))) run('copy', () => orderShareApi.copy(kind, id))
                    }}
                  >
                    <option value="">{t('order.copyFrom')}</option>
                    {data.users.map((u) => <option key={u.id} value={u.id}>{u.name} · …{u.phoneEnd}</option>)}
                  </select>
                  {busy === 'copy' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('order.copyHint')}</p>
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </Card>
      )}
    </div>
  )
}
