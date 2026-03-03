import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Users, ChevronRight, IndianRupee } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { RouteFilter } from '@/components/common'
import { useRouteStore } from '@/store'
import { routesApi } from '@/services/api'
import { formatCurrency } from '@/utils'
import type { ApiResponse } from '@/types'

type RecipientType = 'farmer' | 'customer'

interface RouteFarmerItem {
  id: string
  farmerId: string
  areaId?: string | null
  farmer: {
    id: string
    name: string
    phone?: string
    village?: string
    isActive: boolean
    balance: number
  }
}

interface RouteCustomerItem {
  id: string
  customerId: string
  areaId?: string | null
  customer: {
    id: string
    name: string
    phone?: string
    address?: string
    isActive: boolean
    balance: number
  }
}

interface RouteDetailData {
  id: string
  routeFarmers: RouteFarmerItem[]
  routeCustomers: RouteCustomerItem[]
}

export function PaymentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)

  const [recipientType, setRecipientType] = useState<RecipientType>('farmer')
  const [farmers, setFarmers] = useState<RouteFarmerItem[]>([])
  const [customers, setCustomers] = useState<RouteCustomerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!selectedRouteId) {
      setFarmers([])
      setCustomers([])
      return
    }

    const fetchRouteData = async () => {
      setIsLoading(true)
      try {
        const response = await routesApi.get(selectedRouteId) as ApiResponse<RouteDetailData>
        if (response.success && response.data) {
          setFarmers(response.data.routeFarmers.filter(rf => rf.farmer.isActive))
          setCustomers(response.data.routeCustomers.filter(rc => rc.customer.isActive))
        }
      } catch (error) {
        console.error('Failed to fetch route data:', error)
        setFarmers([])
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchRouteData()
  }, [selectedRouteId])

  const filteredFarmers = selectedAreaId
    ? farmers.filter((rf) => rf.areaId === selectedAreaId)
    : farmers

  const filteredCustomers = selectedAreaId
    ? customers.filter((rc) => rc.areaId === selectedAreaId)
    : customers

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

        {/* Route Filter (includes Area Filter) */}
        <RouteFilter />

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
                          <span className={rf.farmer.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}>
                            {formatCurrency(Math.abs(rf.farmer.balance))}
                          </span>
                          {rf.farmer.balance > 0 && (
                            <span className="text-xs text-gray-400">
                              {t('farmer.weOwe')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
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
                          <span className={rc.customer.balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                            {formatCurrency(Math.abs(rc.customer.balance))}
                          </span>
                          {rc.customer.balance > 0 && (
                            <span className="text-xs text-gray-400">
                              {t('customer.theyOwe')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
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
