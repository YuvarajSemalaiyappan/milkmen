import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useRoutes } from '@/hooks'
import { customersApi } from '@/services/api'
import type { ApiResponse, Customer } from '@/types'

interface RouteDetail {
  id: string
  name: string
  routeCustomers: Array<{ customer: { id: string } }>
}

export function RouteAssignCustomersPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRoute, assignCustomers } = useRoutes()

  const [customers, setCustomers] = useState<Customer[]>([])
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
        setSelectedIds(new Set(routeData.routeCustomers.map(rc => rc.customer.id)))
      }

      const response = await customersApi.list() as ApiResponse<Customer[]>
      if (response.success && response.data) {
        setCustomers(response.data.filter(c => c.isActive))
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

  const toggleCustomer = (customerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!id) return
    try {
      setIsSaving(true)
      await assignCustomers(id, Array.from(selectedIds))
      navigate(`/routes/${id}`)
    } catch (error) {
      console.error('Failed to assign customers:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredCustomers = searchQuery
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery) ||
        c.address?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers

  return (
    <AppShell title={`${t('routes.assignCustomers')} - ${routeName}`} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
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
              {filteredCustomers.map((customer) => (
                <Card
                  key={customer.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.has(customer.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : ''
                  }`}
                  onClick={() => toggleCustomer(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="text-sm text-gray-500">
                        {[customer.address, customer.phone].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                    {selectedIds.has(customer.id) && (
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
