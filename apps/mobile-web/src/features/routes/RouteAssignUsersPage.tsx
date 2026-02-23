import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { useRoutes } from '@/hooks'
import { api } from '@/services/api'
import type { ApiResponse, User } from '@/types'

interface RouteDetail {
  id: string
  name: string
  userRoutes: Array<{ user: { id: string } }>
}

export function RouteAssignUsersPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRoute, assignUsers } = useRoutes()

  const [users, setUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [routeName, setRouteName] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)

      // Load route details to get existing assignments
      const routeData = await getRoute(id) as RouteDetail | null
      if (routeData) {
        setRouteName(routeData.name)
        setSelectedIds(new Set(routeData.userRoutes.map(ur => ur.user.id)))
      }

      // Load all users (via settings API)
      const response = await api.get('/settings/staff') as ApiResponse<User[]>
      if (response.success && response.data) {
        setUsers(response.data.filter(u => u.isActive))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [id, getRoute])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleUser = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!id) return
    try {
      setIsSaving(true)
      await assignUsers(id, Array.from(selectedIds))
      navigate(`/routes/${id}`)
    } catch (error) {
      console.error('Failed to assign users:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell title={`${t('routes.assignStaff')} - ${routeName}`} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('routes.selectStaffDescription')}
            </p>

            <div className="space-y-2">
              {users.map((user) => (
                <Card
                  key={user.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(user.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : ''
                  }`}
                  onClick={() => toggleUser(user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.phone} - {user.role}</p>
                    </div>
                    {selectedIds.has(user.id) && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {users.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">
                {t('settings.noStaff')}
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                fullWidth
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                fullWidth
              >
                {t('common.save')} ({selectedIds.size})
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
