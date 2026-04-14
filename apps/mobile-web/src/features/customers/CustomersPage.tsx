import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, UserCircle, Phone, MapPin, ChevronRight, Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { EmptyState, RouteFilter } from '@/components/common'
import { useCustomers } from '@/hooks'
import { useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
import { formatCurrency } from '@/utils'
import type { Customer, ApiResponse, RouteCustomer } from '@/types'

type StatusFilter = 'all' | 'active' | 'inactive'

export function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { customers: allCustomers, activeCustomers, searchCustomers, isLoading } = useCustomers()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [routeCustomers, setRouteCustomers] = useState<RouteCustomer[] | undefined>(undefined)

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteCustomers(undefined)
      return
    }
    const fetchRouteAssignments = async () => {
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<{ routeCustomers: RouteCustomer[] }>
        if (response.success && response.data) {
          setRouteCustomers(response.data.routeCustomers)
        }
      } catch (error) {
        console.error('Failed to fetch route customers:', error)
      }
    }
    fetchRouteAssignments()
  }, [selectedRouteId])

  // Get the base list based on status filter
  const baseCustomers = statusFilter === 'active'
    ? activeCustomers
    : statusFilter === 'inactive'
      ? allCustomers.filter((c) => !c.isActive)
      : allCustomers

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery) {
        const results = await searchCustomers(searchQuery, statusFilter === 'active')
        if (statusFilter === 'inactive') {
          setFilteredCustomers(results.filter((c) => !c.isActive))
        } else {
          setFilteredCustomers(results)
        }
      } else {
        setFilteredCustomers(baseCustomers)
      }
    }
    doSearch()
  }, [searchQuery, baseCustomers, searchCustomers, statusFilter])

  // Apply route/area filter
  const customers = useMemo(() => {
    const list = searchQuery ? filteredCustomers : baseCustomers
    if (!selectedRouteId || !routeCustomers) return list

    const assignedIds = new Set(
      (selectedAreaId
        ? routeCustomers.filter((rc) => rc.areaId === selectedAreaId)
        : routeCustomers
      ).map((rc) => rc.customerId)
    )
    return list.filter((c) => assignedIds.has(c.id))
  }, [searchQuery, filteredCustomers, baseCustomers, selectedRouteId, selectedAreaId, routeCustomers])

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'active', label: t('common.active') },
    { key: 'inactive', label: t('common.inactive') }
  ]

  return (
    <AppShell
      title={t('customer.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/customers/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Search */}
        <Input
          placeholder={t('customer.searchCustomers')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />

        {/* Route Filter */}
        <RouteFilter />

        {/* Status Filter Chips */}
        <div className="flex gap-2">
          {statusChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(chip.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                statusFilter === chip.key
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('common.loading')}...
          </div>
        )}

        {/* Customers List */}
        {!isLoading && customers.length === 0 ? (
          <EmptyState
            icon={<UserCircle className="w-16 h-16" />}
            title={searchQuery ? t('customer.noResults') : t('customer.noCustomers')}
            description={searchQuery ? t('customer.tryDifferentSearch') : t('customer.addFirst')}
            action={
              !searchQuery
                ? {
                    label: t('customer.addNew'),
                    onClick: () => navigate('/customers/add')
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  !customer.isActive ? 'opacity-60' : ''
                }`}
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {customer.name}
                      </h3>
                      {!customer.isActive && (
                        <Badge size="sm" variant="default">{t('common.inactive')}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.address}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      {/* Subscription Info */}
                      {customer.subscriptionQtyAM && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Sun className="w-3 h-3" /> {customer.subscriptionQtyAM}L
                        </Badge>
                      )}
                      {customer.subscriptionQtyPM && (
                        <Badge variant="info" className="flex items-center gap-1">
                          <Moon className="w-3 h-3" /> {customer.subscriptionQtyPM}L
                        </Badge>
                      )}

                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(customer.defaultRate)}/L
                      </span>

                      {/* Balance Due */}
                      {customer.balance > 0 && (
                        <Badge variant="error">
                          {t('customer.due')}: {formatCurrency(customer.balance)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Customer Count */}
        {!isLoading && customers.length > 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {customers.length} {t('customer.customersFound')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
