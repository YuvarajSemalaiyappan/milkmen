import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Users, ChevronRight, IndianRupee, Search, ArrowUpDown, History } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { RouteFilter } from '@/components/common'
import { useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
import { formatCurrency } from '@/utils'
import type { ApiResponse } from '@/types'

type RecipientType = 'farmer' | 'customer'
type SortMode = 'name' | 'balance'

interface RoutePerson {
  id: string
  areaId?: string
  person: { id: string; name: string; phone?: string; balance: number }
}

interface RouteDetailData {
  id: string
  routeFarmers: Array<{ id: string; farmerId: string; areaId?: string; farmer: { id: string; name: string; phone?: string; balance: number; isActive: boolean } }>
  routeCustomers: Array<{ id: string; customerId: string; areaId?: string; customer: { id: string; name: string; phone?: string; balance: number; isActive: boolean } }>
}

export function PaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [recipientType, setRecipientType] = useState<RecipientType>('farmer')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('balance')
  const [routeFarmers, setRouteFarmers] = useState<RoutePerson[]>([])
  const [routeCustomers, setRouteCustomers] = useState<RoutePerson[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteFarmers([])
      setRouteCustomers([])
      return
    }
    const fetchRouteData = async () => {
      setIsLoading(true)
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<RouteDetailData>
        if (response.success && response.data) {
          setRouteFarmers(
            response.data.routeFarmers
              .filter(rf => rf.farmer.isActive)
              .map(rf => ({ id: rf.id, areaId: rf.areaId, person: { id: rf.farmer.id, name: rf.farmer.name, phone: rf.farmer.phone, balance: rf.farmer.balance } }))
          )
          setRouteCustomers(
            response.data.routeCustomers
              .filter(rc => rc.customer.isActive)
              .map(rc => ({ id: rc.id, areaId: rc.areaId, person: { id: rc.customer.id, name: rc.customer.name, phone: rc.customer.phone, balance: rc.customer.balance } }))
          )
        }
      } catch (error) {
        console.error('Failed to fetch route data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRouteData()
  }, [selectedRouteId])

  const filteredFarmers = useMemo(() => {
    let list = routeFarmers
    if (selectedAreaId) list = list.filter(rf => rf.areaId === selectedAreaId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(rf => rf.person.name.toLowerCase().includes(q))
    }
    if (sortMode === 'balance') {
      list = [...list].sort((a, b) => b.person.balance - a.person.balance)
    } else {
      list = [...list].sort((a, b) => a.person.name.localeCompare(b.person.name))
    }
    return list
  }, [routeFarmers, selectedAreaId, searchQuery, sortMode])

  const filteredCustomers = useMemo(() => {
    let list = routeCustomers
    if (selectedAreaId) list = list.filter(rc => rc.areaId === selectedAreaId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(rc => rc.person.name.toLowerCase().includes(q))
    }
    if (sortMode === 'balance') {
      list = [...list].sort((a, b) => b.person.balance - a.person.balance)
    } else {
      list = [...list].sort((a, b) => a.person.name.localeCompare(b.person.name))
    }
    return list
  }, [routeCustomers, selectedAreaId, searchQuery, sortMode])

  return (
    <AppShell title={t('payment.title')}>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Farmer / Customer Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setRecipientType('farmer')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              recipientType === 'farmer'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {t('payment.payFarmer')}
          </button>
          <button
            onClick={() => setRecipientType('customer')}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              recipientType === 'customer'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {t('payment.receiveCustomer')}
          </button>
        </div>

        {/* Route Filter */}
        <RouteFilter />

        {/* Search and Sort */}
        {selectedRouteId && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search')}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <button
              onClick={() => setSortMode(m => m === 'name' ? 'balance' : 'name')}
              className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              title={sortMode === 'name' ? t('payment.sortByBalance') : t('payment.sortByName')}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* People List */}
        {!selectedRouteId ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('routes.allRoutes')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('payment.selectRouteHint')}
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : recipientType === 'farmer' ? (
          filteredFarmers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {selectedAreaId ? t('areas.noFarmersAssigned') : t('routes.noFarmersAssigned')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredFarmers.length} {t('farmer.farmersFound')}
              </p>
              {filteredFarmers.map((rf) => (
                <Card
                  key={rf.person.id}
                  className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                  onClick={() => navigate(`/payments/add?type=farmer&farmerId=${rf.person.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {rf.person.name}
                      </p>
                      {rf.person.balance !== 0 && (
                        <div className="flex items-center gap-1 text-sm mt-1">
                          <IndianRupee className="w-3 h-3 text-gray-400" />
                          <span className={rf.person.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                            {formatCurrency(Math.abs(rf.person.balance))}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rf.person.balance > 0 ? t('farmer.weOwe') : t('payment.overpaid')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/payments/history?farmerId=${rf.person.id}`) }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {selectedAreaId ? t('areas.noCustomersAssigned') : t('routes.noCustomersAssigned')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredCustomers.length} {t('customer.customersFound')}
              </p>
              {filteredCustomers.map((rc) => (
                <Card
                  key={rc.person.id}
                  className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                  onClick={() => navigate(`/payments/add?type=customer&customerId=${rc.person.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {rc.person.name}
                      </p>
                      {rc.person.balance !== 0 && (
                        <div className="flex items-center gap-1 text-sm mt-1">
                          <IndianRupee className="w-3 h-3 text-gray-400" />
                          <span className={rc.person.balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatCurrency(Math.abs(rc.person.balance))}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rc.person.balance > 0 ? t('customer.theyOwe') : t('payment.overpaid')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/payments/history?customerId=${rc.person.id}`) }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}
