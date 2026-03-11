import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, User, Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { ShiftToggle, QuickPad, RouteFilter, SortableList } from '@/components/common'
import { useFarmers, useCollections, useRouteFarmerIds, useSortOrder } from '@/hooks'
import { useAppStore, useRouteStore } from '@/store'
import { farmersApi } from '@/services/api'
import { formatCurrency, formatRate, getToday } from '@/utils/format'
import { calculateTotal } from '@/utils/calculate'
import type { LocalFarmer, ApiResponse, Farmer } from '@/types'

type Step = 'select-farmer' | 'enter-quantity'

export function AddCollectionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentShift = useAppStore((state) => state.currentShift)
  const setCurrentShift = useAppStore((state) => state.setCurrentShift)

  const { activeFarmers, searchFarmers, isLoading } = useFarmers()
  const { addCollection } = useCollections()
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
  const selectedAreaId = useRouteStore((state) => state.selectedAreaId)
  const { farmerIds: routeFarmerIds } = useRouteFarmerIds(selectedRouteId, selectedAreaId)

  const [step, setStep] = useState<Step>('select-farmer')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredFarmers, setFilteredFarmers] = useState<LocalFarmer[]>([])
  const [selectedFarmer, setSelectedFarmer] = useState<LocalFarmer | null>(null)
  const [quantity, setQuantity] = useState('')
  const [rate, setRate] = useState('')
  const [fatContent, setFatContent] = useState('')
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if farmer is pre-selected
  useEffect(() => {
    const farmerId = searchParams.get('farmerId')
    if (!farmerId || selectedFarmer) return

    // Try local DB first
    const farmer = activeFarmers.find((f) => f.id === farmerId)
    if (farmer) {
      selectFarmer(farmer)
      return
    }

    // Fall back to server API if not found locally
    if (activeFarmers.length > 0 || isLoading) return
    const fetchFarmer = async () => {
      try {
        const response = await farmersApi.get(farmerId) as ApiResponse<Farmer>
        if (response.success && response.data) {
          const f = response.data
          const local: LocalFarmer = {
            id: f.id,
            localId: f.id,
            syncStatus: 'SYNCED',
            createdAt: new Date(f.createdAt).getTime(),
            updatedAt: new Date(f.updatedAt).getTime(),
            data: {
              name: f.name,
              phone: f.phone,
              village: f.village,
              defaultRate: f.defaultRate,
              isActive: f.isActive,
              balance: f.balance,
            },
          }
          selectFarmer(local)
        }
      } catch (error) {
        console.error('Failed to fetch farmer:', error)
      }
    }
    fetchFarmer()
  }, [searchParams, activeFarmers, isLoading, selectedFarmer])

  // Filter farmers on search
  useEffect(() => {
    const filter = async () => {
      const results = await searchFarmers(searchQuery)
      setFilteredFarmers(results)
    }
    filter()
  }, [searchQuery, searchFarmers])

  // Initialize filtered farmers
  useEffect(() => {
    setFilteredFarmers(activeFarmers)
  }, [activeFarmers])

  const { applySortOrder, saveSortOrder } = useSortOrder('farmer')

  // Filter by route/area
  const routeFilteredFarmers = useMemo(() => {
    const filtered = routeFarmerIds
      ? filteredFarmers.filter(f => routeFarmerIds.has(f.id))
      : filteredFarmers
    return applySortOrder(filtered)
  }, [filteredFarmers, routeFarmerIds, applySortOrder])

  const handleReorder = useCallback((newIds: string[]) => {
    saveSortOrder(newIds)
  }, [saveSortOrder])

  const selectFarmer = (farmer: LocalFarmer) => {
    setSelectedFarmer(farmer)
    setRate(farmer.data.defaultRate.toString())
    // Pre-fill subscription quantity based on current shift
    const subscriptionQty = currentShift === 'MORNING'
      ? farmer.data.subscriptionQtyAM
      : farmer.data.subscriptionQtyPM
    if (subscriptionQty) {
      setQuantity(subscriptionQty.toString())
    }
    setStep('enter-quantity')
  }

  const handleSubmit = async (navigateTo?: string) => {
    if (!selectedFarmer || !quantity || !rate) return

    try {
      setIsSubmitting(true)
      await addCollection({
        farmerId: selectedFarmer.id,
        date: selectedDate,
        shift: currentShift,
        quantity: parseFloat(quantity),
        fatContent: fatContent ? parseFloat(fatContent) : undefined,
        ratePerLiter: parseFloat(rate),
        notes: notes || undefined
      })
      navigate(navigateTo || '/collect')
    } catch (error) {
      console.error('Failed to add collection:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const total = quantity && rate
    ? calculateTotal(parseFloat(quantity), parseFloat(rate))
    : 0

  return (
    <AppShell title={t('collection.addCollection')} showBack>
      <div className={`px-4 pt-4 pb-4 ${step === 'select-farmer' ? 'space-y-4' : 'space-y-3'}`}>
        {/* Date & Shift */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            max={getToday()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
          />
          <ShiftToggle
            value={currentShift}
            onChange={setCurrentShift}
          />
        </div>

        {step === 'select-farmer' && (
          <>
            {/* Route Filter */}
            <RouteFilter />

            {/* Search */}
            <Input
              placeholder={t('collection.selectFarmer')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />

            {/* Farmer List */}
            <Card padding="none">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <SortableList
                  items={routeFilteredFarmers.map((f) => f.id)}
                  onReorder={handleReorder}
                  renderItem={(id) => {
                    const farmer = routeFilteredFarmers.find((f) => f.id === id)!
                    const hasAM = farmer.data.collectAM !== false
                    const hasPM = !!farmer.data.collectPM
                    const isCurrentShiftActive = currentShift === 'MORNING' ? hasAM : hasPM
                    return (
                      <button
                        onClick={() => selectFarmer(farmer)}
                        className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          !isCurrentShiftActive ? 'opacity-50' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCurrentShiftActive
                            ? 'bg-blue-100 dark:bg-blue-900/50'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <User className={`w-5 h-5 ${
                            isCurrentShiftActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {farmer.data.name}
                          </p>
                          {farmer.data.village && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {farmer.data.village}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatRate(farmer.data.defaultRate)}
                          </p>
                          <div className="flex items-center gap-1">
                            {hasAM && (
                              <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                currentShift === 'MORNING'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                <Sun className="w-3 h-3" />
                                {farmer.data.subscriptionQtyAM ? `${farmer.data.subscriptionQtyAM}L` : 'AM'}
                              </span>
                            )}
                            {hasPM && (
                              <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                currentShift === 'EVENING'
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                <Moon className="w-3 h-3" />
                                {farmer.data.subscriptionQtyPM ? `${farmer.data.subscriptionQtyPM}L` : 'PM'}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  }}
                />
              </div>
            </Card>
          </>
        )}

        {step === 'enter-quantity' && selectedFarmer && (
          <div className="flex flex-col">
            {/* Farmer Info + Rate/Fat/Notes */}
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {selectedFarmer.data.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedFarmer.data.village}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/farmers/${selectedFarmer.id}`)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep('select-farmer')
                      setSelectedFarmer(null)
                      setQuantity('')
                      searchParams.delete('farmerId')
                      setSearchParams(searchParams, { replace: true })
                    }}
                  >
                    {t('common.change')}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label={t('collection.ratePerLiter')}
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
                <Input
                  label={t('collection.fatContent')}
                  type="number"
                  step="0.1"
                  placeholder="--"
                  value={fatContent}
                  onChange={(e) => setFatContent(e.target.value)}
                />
                <Input
                  label={t('common.notes')}
                  placeholder="--"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </Card>

            {/* Quantity Entry */}
            <Card className="mt-3">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {quantity || '0'} <span className="text-lg">L</span>
                </p>
              </div>
              <QuickPad
                value={quantity}
                onChange={setQuantity}
                defaultFullPad
              />
            </Card>

            {/* Total + Submit */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 bg-blue-50 dark:bg-blue-900/30 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">{t('collection.totalAmount')}</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleSubmit()}
                  isLoading={isSubmitting}
                  disabled={!quantity || parseFloat(quantity) <= 0}
                  size="lg"
                  className="px-8"
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(`/payments/add?type=farmer&farmerId=${selectedFarmer.id}&from=/collect`)}
                  isLoading={isSubmitting}
                  disabled={!quantity || parseFloat(quantity) <= 0}
                  size="sm"
                >
                  {t('payment.saveAndPay')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
