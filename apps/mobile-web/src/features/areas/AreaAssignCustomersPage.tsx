import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

interface RouteCustomerItem {
  id: string
  customerId: string
  areaId?: string | null
  sortOrder: number
  customer: { id: string; name: string; phone?: string; address?: string }
}

interface RouteDetailData {
  id: string
  routeCustomers: RouteCustomerItem[]
}

export function AreaAssignCustomersPage() {
  const { t } = useTranslation()
  const { routeId, areaId } = useParams<{ routeId: string; areaId: string }>()
  const navigate = useNavigate()
  const [routeCustomers, setRouteCustomers] = useState<RouteCustomerItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!routeId) return
    try {
      setIsLoading(true)
      const response = await routesApi.get(routeId) as ApiResponse<RouteDetailData>
      if (response.success && response.data) {
        setRouteCustomers(response.data.routeCustomers)
        // Pre-select customers already assigned to this area
        const alreadyAssigned = response.data.routeCustomers
          .filter((rc) => rc.areaId === areaId)
          .map((rc) => rc.customerId)
        setSelectedIds(new Set(alreadyAssigned))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [routeId, areaId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleCustomer = (customerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }

  // Only show customers not assigned to another area, or already in this area
  const eligibleCustomers = routeCustomers.filter(
    (rc) => !rc.areaId || rc.areaId === areaId
  )

  const filteredCustomers = searchQuery
    ? eligibleCustomers.filter(
        (rc) =>
          rc.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          rc.customer.phone?.includes(searchQuery) ||
          rc.customer.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : eligibleCustomers

  const handleSave = async () => {
    if (!routeId) return
    try {
      setIsSaving(true)
      const allCustomerIds = routeCustomers.map((rc) => rc.customerId)
      const sortOrders: Record<string, number> = {}
      const areaIds: Record<string, string> = {}

      routeCustomers.forEach((rc) => {
        sortOrders[rc.customerId] = rc.sortOrder
        if (selectedIds.has(rc.customerId)) {
          areaIds[rc.customerId] = areaId!
        } else if (rc.areaId && rc.areaId !== areaId) {
          areaIds[rc.customerId] = rc.areaId
        }
      })

      await routesApi.assignCustomers(routeId, allCustomerIds, sortOrders, areaIds)
      navigate(`/routes/${routeId}/areas/${areaId}`)
    } catch (error) {
      console.error('Failed to assign customers:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell title={t('areas.assignCustomers')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : (
          <>
            <Input
              placeholder={t('customer.searchCustomers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedIds.size} {t('routes.selected')}
            </p>

            <div className="space-y-2">
              {filteredCustomers.map((rc) => (
                <Card
                  key={rc.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(rc.customerId)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : ''
                  }`}
                  onClick={() => toggleCustomer(rc.customerId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {rc.customer.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {[rc.customer.address, rc.customer.phone]
                          .filter(Boolean)
                          .join(' - ')}
                      </p>
                    </div>
                    {selectedIds.has(rc.customerId) && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {filteredCustomers.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">
                {t('customer.noCustomers')}
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
