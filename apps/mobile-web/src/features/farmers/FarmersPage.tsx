import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Users, Phone, MapPin, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { EmptyState, RouteFilter } from '@/components/common'
import { useFarmers } from '@/hooks'
import { useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
import { formatCurrency } from '@/utils'
import type { Farmer, ApiResponse, RouteFarmer } from '@/types'

type StatusFilter = 'all' | 'active' | 'inactive'

export function FarmersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { farmers: allFarmers, activeFarmers, searchFarmers, isLoading } = useFarmers()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredFarmers, setFilteredFarmers] = useState<Farmer[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [routeFarmers, setRouteFarmers] = useState<RouteFarmer[] | undefined>(undefined)

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteFarmers(undefined)
      return
    }
    const fetchRouteAssignments = async () => {
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<{ routeFarmers: RouteFarmer[] }>
        if (response.success && response.data) {
          setRouteFarmers(response.data.routeFarmers)
        }
      } catch (error) {
        console.error('Failed to fetch route farmers:', error)
      }
    }
    fetchRouteAssignments()
  }, [selectedRouteId])

  // Get the base list based on status filter
  const baseFarmers = statusFilter === 'active'
    ? activeFarmers
    : statusFilter === 'inactive'
      ? allFarmers.filter((f) => !f.isActive)
      : allFarmers

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery) {
        const results = await searchFarmers(searchQuery, statusFilter === 'active')
        if (statusFilter === 'inactive') {
          setFilteredFarmers(results.filter((f) => !f.isActive))
        } else {
          setFilteredFarmers(results)
        }
      } else {
        setFilteredFarmers(baseFarmers)
      }
    }
    doSearch()
  }, [searchQuery, baseFarmers, searchFarmers, statusFilter])

  // Apply route/area filter
  const farmers = useMemo(() => {
    const list = searchQuery ? filteredFarmers : baseFarmers
    if (!selectedRouteId || !routeFarmers) return list

    const assignedIds = new Set(
      (selectedAreaId
        ? routeFarmers.filter((rf) => rf.areaId === selectedAreaId)
        : routeFarmers
      ).map((rf) => rf.farmerId)
    )
    return list.filter((f) => assignedIds.has(f.id))
  }, [searchQuery, filteredFarmers, baseFarmers, selectedRouteId, selectedAreaId, routeFarmers])

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'active', label: t('common.active') },
    { key: 'inactive', label: t('common.inactive') }
  ]

  return (
    <AppShell
      title={t('farmer.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/farmers/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Search */}
        <Input
          placeholder={t('farmer.searchFarmers')}
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

        {/* Farmers List */}
        {!isLoading && farmers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title={searchQuery ? t('farmer.noResults') : t('farmer.noFarmers')}
            description={searchQuery ? t('farmer.tryDifferentSearch') : t('farmer.addFirst')}
            action={
              !searchQuery
                ? {
                    label: t('farmer.addNew'),
                    onClick: () => navigate('/farmers/add')
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {farmers.map((farmer) => (
              <Card
                key={farmer.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  !farmer.isActive ? 'opacity-60' : ''
                }`}
                onClick={() => navigate(`/farmers/${farmer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {farmer.name}
                      </h3>
                      {!farmer.isActive && (
                        <Badge size="sm" variant="default">{t('common.inactive')}</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {farmer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {farmer.phone}
                        </span>
                      )}
                      {farmer.village && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {farmer.village}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {t('farmer.rate')}: {formatCurrency(farmer.defaultRate)}/L
                      </span>
                      {farmer.balance > 0 && (
                        <Badge variant="warning">
                          {t('farmer.due')}: {formatCurrency(farmer.balance)}
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

        {/* Farmer Count */}
        {!isLoading && farmers.length > 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {farmers.length} {t('farmer.farmersFound')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
