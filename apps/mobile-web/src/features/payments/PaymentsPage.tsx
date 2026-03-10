import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Users, ChevronRight, IndianRupee, Search, ArrowUpDown, History } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { RouteFilter } from '@/components/common'
import { useRouteStore } from '@/store'
import { db } from '@/db/localDb'
import { formatCurrency } from '@/utils'

type RecipientType = 'farmer' | 'customer'
type SortMode = 'name' | 'balance'

export function PaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [recipientType, setRecipientType] = useState<RecipientType>('farmer')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('balance')

  // Fetch route farmers from local DB
  const routeFarmers = useLiveQuery(async () => {
    if (!selectedRouteId) return []
    const rfs = await db.routeFarmers.where('routeId').equals(selectedRouteId).toArray()
    const farmerIds = rfs.map(rf => rf.farmerId)
    const farmers = await db.farmers.bulkGet(farmerIds)
    return rfs.map(rf => {
      const farmer = farmers.find(f => f?.id === rf.farmerId)
      if (!farmer || !farmer.data.isActive) return null
      return { ...rf, farmer: { id: farmer.id, name: farmer.data.name, phone: farmer.data.phone, balance: farmer.data.balance } }
    }).filter(Boolean) as Array<{ id: string; farmerId: string; areaId?: string; farmer: { id: string; name: string; phone?: string; balance: number } }>
  }, [selectedRouteId])

  // Fetch route customers from local DB
  const routeCustomers = useLiveQuery(async () => {
    if (!selectedRouteId) return []
    const rcs = await db.routeCustomers.where('routeId').equals(selectedRouteId).toArray()
    const customerIds = rcs.map(rc => rc.customerId)
    const customers = await db.customers.bulkGet(customerIds)
    return rcs.map(rc => {
      const customer = customers.find(c => c?.id === rc.customerId)
      if (!customer || !customer.data.isActive) return null
      return { ...rc, customer: { id: customer.id, name: customer.data.name, phone: customer.data.phone, balance: customer.data.balance } }
    }).filter(Boolean) as Array<{ id: string; customerId: string; areaId?: string; customer: { id: string; name: string; phone?: string; balance: number } }>
  }, [selectedRouteId])

  const filteredFarmers = useMemo(() => {
    let list = routeFarmers ?? []
    if (selectedAreaId) list = list.filter(rf => rf.areaId === selectedAreaId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(rf => rf.farmer.name.toLowerCase().includes(q))
    }
    if (sortMode === 'balance') {
      list = [...list].sort((a, b) => b.farmer.balance - a.farmer.balance)
    } else {
      list = [...list].sort((a, b) => a.farmer.name.localeCompare(b.farmer.name))
    }
    return list
  }, [routeFarmers, selectedAreaId, searchQuery, sortMode])

  const filteredCustomers = useMemo(() => {
    let list = routeCustomers ?? []
    if (selectedAreaId) list = list.filter(rc => rc.areaId === selectedAreaId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(rc => rc.customer.name.toLowerCase().includes(q))
    }
    if (sortMode === 'balance') {
      list = [...list].sort((a, b) => b.customer.balance - a.customer.balance)
    } else {
      list = [...list].sort((a, b) => a.customer.name.localeCompare(b.customer.name))
    }
    return list
  }, [routeCustomers, selectedAreaId, searchQuery, sortMode])

  const isLoading = selectedRouteId ? (recipientType === 'farmer' ? routeFarmers === undefined : routeCustomers === undefined) : false

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
                  key={rf.farmer.id}
                  className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                  onClick={() => navigate(`/payments/add?type=farmer&farmerId=${rf.farmer.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {rf.farmer.name}
                      </p>
                      {rf.farmer.balance !== 0 && (
                        <div className="flex items-center gap-1 text-sm mt-1">
                          <IndianRupee className="w-3 h-3 text-gray-400" />
                          <span className={rf.farmer.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                            {formatCurrency(Math.abs(rf.farmer.balance))}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rf.farmer.balance > 0 ? t('farmer.weOwe') : t('payment.overpaid')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/payments/history?farmerId=${rf.farmer.id}`) }}
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
                  key={rc.customer.id}
                  className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                  onClick={() => navigate(`/payments/add?type=customer&customerId=${rc.customer.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {rc.customer.name}
                      </p>
                      {rc.customer.balance !== 0 && (
                        <div className="flex items-center gap-1 text-sm mt-1">
                          <IndianRupee className="w-3 h-3 text-gray-400" />
                          <span className={rc.customer.balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatCurrency(Math.abs(rc.customer.balance))}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rc.customer.balance > 0 ? t('customer.theyOwe') : t('payment.overpaid')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/payments/history?customerId=${rc.customer.id}`) }}
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
