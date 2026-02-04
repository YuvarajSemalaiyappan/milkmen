import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useRoutes } from '@/hooks'
import { farmersApi } from '@/services/api'
import type { ApiResponse, Farmer } from '@/types'

interface RouteDetail {
  id: string
  name: string
  routeFarmers: Array<{ farmer: { id: string } }>
}

export function RouteAssignFarmersPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRoute, assignFarmers } = useRoutes()

  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [routeName, setRouteName] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setIsLoading(true)

      const routeData = await getRoute(id) as RouteDetail | null
      if (routeData) {
        setRouteName(routeData.name)
        setSelectedIds(new Set(routeData.routeFarmers.map(rf => rf.farmer.id)))
      }

      const response = await farmersApi.list() as ApiResponse<Farmer[]>
      if (response.success && response.data) {
        setFarmers(response.data.filter(f => f.isActive))
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

  const toggleFarmer = (farmerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(farmerId)) {
        next.delete(farmerId)
      } else {
        next.add(farmerId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!id) return
    try {
      setIsSaving(true)
      await assignFarmers(id, Array.from(selectedIds))
      navigate(`/routes/${id}`)
    } catch (error) {
      console.error('Failed to assign farmers:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredFarmers = searchQuery
    ? farmers.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.phone?.includes(searchQuery) ||
        f.village?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : farmers

  return (
    <AppShell title={`${t('routes.assignFarmers')} - ${routeName}`} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        ) : (
          <>
            <Input
              placeholder={t('farmer.searchFarmers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedIds.size} {t('routes.selected')}
            </p>

            <div className="space-y-2">
              {filteredFarmers.map((farmer) => (
                <Card
                  key={farmer.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(farmer.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : ''
                  }`}
                  onClick={() => toggleFarmer(farmer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{farmer.name}</p>
                      <p className="text-sm text-gray-500">
                        {[farmer.village, farmer.phone].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                    {selectedIds.has(farmer.id) && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {filteredFarmers.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">
                {t('farmer.noFarmers')}
              </p>
            )}

            <div className="flex gap-3 pt-4 sticky bottom-4">
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
