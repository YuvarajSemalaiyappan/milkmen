import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Trash2,
  Phone,
  MapPin,
  IndianRupee,
  TrendingUp,
  Calendar,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useFarmers, useCollections, usePayments, useRoutes, useAreas } from '@/hooks'
import { routesApi } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils'
import type { Farmer, Collection, ApiResponse } from '@/types'

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  village: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  collectAM: z.boolean(),
  collectPM: z.boolean(),
  subscriptionQtyAM: z.number().min(0).optional(),
  subscriptionQtyPM: z.number().min(0).optional()
})

type FarmerFormData = z.infer<typeof farmerSchema>

export function FarmerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getFarmer, updateFarmer, deleteFarmer } = useFarmers()
  const { getCollectionsByFarmer } = useCollections()
  const { getPaymentsByFarmer } = usePayments()
  const { routes } = useRoutes()

  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null)
  const [paidPeriods, setPaidPeriods] = useState<{ from: string; to: string }[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const { areas } = useAreas(selectedRouteId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors }
  } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema)
  })

  const collectAM = useWatch({ control, name: 'collectAM' })
  const collectPM = useWatch({ control, name: 'collectPM' })

  useEffect(() => {
    if (id) {
      loadFarmer()
      loadCollections()
      loadLastPaymentDate()
    }
  }, [id])

  const loadFarmer = async () => {
    if (!id) return
    const data = await getFarmer(id)
    if (data) {
      setFarmer(data)
      reset({
        name: data.name,
        phone: data.phone || '',
        village: data.village || '',
        defaultRate: data.defaultRate,
        collectAM: data.collectAM ?? true,
        collectPM: data.collectPM ?? false,
        subscriptionQtyAM: data.subscriptionQtyAM,
        subscriptionQtyPM: data.subscriptionQtyPM
      })

      // Load existing route/area assignment from server response
      const farmerDetail = data as Farmer & { routeFarmers?: Array<{ routeId: string; areaId?: string }> }
      if (farmerDetail.routeFarmers && farmerDetail.routeFarmers.length > 0) {
        setSelectedRouteId(farmerDetail.routeFarmers[0].routeId)
        setSelectedAreaId(farmerDetail.routeFarmers[0].areaId || null)
      }
    }
  }

  const loadCollections = async () => {
    if (!id) return
    const data = await getCollectionsByFarmer(id, undefined, undefined, 10)
    setCollections(data)
  }

  const loadLastPaymentDate = async () => {
    if (!id) return
    const payments = await getPaymentsByFarmer(id)
    if (payments.length > 0) {
      // Build sorted list of payment periods (exclude advance payments with no period)
      const paymentsWithPeriod = payments as Array<typeof payments[0] & { periodFromDate?: string; periodToDate?: string }>
      const periods = paymentsWithPeriod
        .filter((p) => p.periodFromDate && p.periodToDate)
        .map((p) => ({ from: p.periodFromDate!, to: p.periodToDate! }))
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

      if (periods.length === 0) {
        setLastPaymentDate(null)
        setPaidPeriods([])
        return
      }

      // Merge contiguous/overlapping periods
      // Two periods are contiguous if the next starts within 1 day of current end
      const merged: { from: string; to: string }[] = [{ ...periods[0] }]
      for (let i = 1; i < periods.length; i++) {
        const current = merged[merged.length - 1]
        const nextDay = new Date(current.to + 'T00:00:00')
        nextDay.setDate(nextDay.getDate() + 1)
        const nextDayStr = nextDay.toISOString().slice(0, 10)
        if (periods[i].from <= nextDayStr) {
          if (periods[i].to > current.to) current.to = periods[i].to
        } else {
          merged.push({ ...periods[i] })
        }
      }
      setPaidPeriods(merged)
      const paidTill = merged.reduce((max, p) => p.to > max ? p.to : max, merged[0].to)
      setLastPaymentDate(paidTill)
    } else {
      setLastPaymentDate(null)
      setPaidPeriods([])
    }
  }

  const onSubmit = async (data: FarmerFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateFarmer(id, {
        name: data.name,
        phone: data.phone || undefined,
        village: data.village || undefined,
        defaultRate: data.defaultRate,
        collectAM: data.collectAM,
        collectPM: data.collectPM,
        subscriptionQtyAM: data.subscriptionQtyAM || undefined,
        subscriptionQtyPM: data.subscriptionQtyPM || undefined
      })

      // Update route assignment if changed
      if (selectedRouteId) {
        try {
          await routesApi.assignFarmers(selectedRouteId, [id], undefined, selectedAreaId ? { [id]: selectedAreaId } : undefined)
        } catch {
          // Non-critical
        }
      }

      setIsEditing(false)
      loadFarmer()
    } catch (error) {
      console.error('Failed to update farmer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await deleteFarmer(id)
      navigate('/farmers')
    } catch (error) {
      console.error('Failed to delete farmer:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleActivate = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await updateFarmer(id, { isActive: true })
      loadFarmer()
    } catch (error) {
      console.error('Failed to activate farmer:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!farmer) {
    return (
      <AppShell title={t('farmer.details')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  const isDatePaid = (date: string) =>
    paidPeriods.some((p) => date >= p.from && date <= p.to)

  const unpaidCollections = collections.filter(
    (c) => !isDatePaid(c.data.date)
  )
  const unpaidQty = unpaidCollections.reduce(
    (sum, c) => sum + Number(c.data.quantity),
    0
  )
  const unpaidAmount = unpaidCollections.reduce(
    (sum, c) => sum + Number(c.data.totalAmount),
    0
  )

  return (
    <AppShell
      title={isEditing ? t('farmer.edit') : farmer.name}
      showBack
      rightAction={
        !isEditing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit2 className="w-4 h-4" />}
          >
            {t('common.edit')}
          </Button>
        )
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isEditing ? (
          // Edit Form
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={t('common.name')}
                placeholder="Enter farmer name"
                error={errors.name?.message}
                {...register('name')}
              />

              <Input
                label={t('common.phone')}
                type="tel"
                placeholder="10-digit phone number"
                error={errors.phone?.message}
                {...register('phone')}
              />

              <Input
                label={t('farmer.village')}
                placeholder="Village name"
                error={errors.village?.message}
                {...register('village')}
              />

              <Input
                label={t('farmer.defaultRate')}
                type="number"
                step="0.01"
                placeholder="Rate per liter"
                error={errors.defaultRate?.message}
                {...register('defaultRate', { valueAsNumber: true })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('farmer.collectionShift')}
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-primary-600 rounded"
                        checked={collectAM}
                        onChange={(e) => setValue('collectAM', e.target.checked)}
                      />
                      <Sun className="w-5 h-5 text-yellow-500" />
                      <span>{t('common.morning')} (AM)</span>
                    </label>
                    {collectAM && (
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Qty (L)"
                        className="w-24 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-right"
                        {...register('subscriptionQtyAM', { valueAsNumber: true, setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-primary-600 rounded"
                        checked={collectPM}
                        onChange={(e) => setValue('collectPM', e.target.checked)}
                      />
                      <Moon className="w-5 h-5 text-blue-500" />
                      <span>{t('common.evening')} (PM)</span>
                    </label>
                    {collectPM && (
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Qty (L)"
                        className="w-24 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-right"
                        {...register('subscriptionQtyPM', { valueAsNumber: true, setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Route / Area Assignment */}
              {routes.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4 mt-4 space-y-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {t('farmer.selectRoute')}
                  </h3>
                  <select
                    value={selectedRouteId || ''}
                    onChange={(e) => {
                      setSelectedRouteId(e.target.value || null)
                      setSelectedAreaId(null)
                    }}
                    className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('common.none')}</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>{route.name}</option>
                    ))}
                  </select>

                  {selectedRouteId && areas.length > 0 && (
                    <>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('farmer.selectArea')}
                      </label>
                      <select
                        value={selectedAreaId || ''}
                        onChange={(e) => setSelectedAreaId(e.target.value || null)}
                        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('common.none')}</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    reset()
                  }}
                  fullWidth
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSubmitting} fullWidth>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <>
            {/* Farmer Info Card */}
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{farmer.name}</h2>
                  <Badge
                    variant={farmer.isActive ? 'success' : 'error'}
                  >
                    {farmer.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>

                {farmer.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${farmer.phone}`} className="text-primary-600">
                      {farmer.phone}
                    </a>
                  </div>
                )}

                {farmer.village && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{farmer.village}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <IndianRupee className="w-4 h-4" />
                  <span>
                    {t('farmer.defaultRate')}: {formatCurrency(farmer.defaultRate)}/L
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  {farmer.collectAM && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Sun className="w-3 h-3" />
                      {t('common.morning')}{farmer.subscriptionQtyAM ? ` · ${farmer.subscriptionQtyAM}L` : ''}
                    </span>
                  )}
                  {farmer.collectPM && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Moon className="w-3 h-3" />
                      {t('common.evening')}{farmer.subscriptionQtyPM ? ` · ${farmer.subscriptionQtyPM}L` : ''}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Balance Card */}
            <Card className={farmer.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('farmer.balance')}</p>
                  <p className={`text-2xl font-bold ${farmer.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(farmer.balance))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {farmer.balance > 0 ? t('farmer.weOwe') : t('farmer.settled')}
                  </p>
                </div>
              </div>
            </Card>

            {/* Unpaid Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-center">
                  <TrendingUp className="w-6 h-6 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-bold">{unpaidQty.toFixed(1)}L</p>
                  <p className="text-xs text-gray-500">{t('farmer.unpaidQty')}</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <IndianRupee className="w-6 h-6 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-bold">{formatCurrency(unpaidAmount)}</p>
                  <p className="text-xs text-gray-500">{t('farmer.unpaidAmount')}</p>
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate(`/collect/add?farmerId=${id}`)}
                fullWidth
              >
                {t('collection.addNew')}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/payments/add?type=farmer&farmerId=${id}`)}
                fullWidth
              >
                {t('payment.payFarmer')}
              </Button>
            </div>

            {/* Delete / Activate Button */}
            <div>
              {!farmer.isActive ? (
                <Button
                  onClick={handleActivate}
                  isLoading={isDeleting}
                  fullWidth
                >
                  {t('common.activate')}
                </Button>
              ) : showDeleteConfirm ? (
                <Card className="bg-red-50 border-red-200">
                  <p className="text-sm text-red-700 mb-3">
                    {t('farmer.deleteConfirm')}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      fullWidth
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleDelete}
                      isLoading={isDeleting}
                      fullWidth
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="text-red-600 hover:bg-red-50"
                  fullWidth
                >
                  {t('farmer.delete')}
                </Button>
              )}
            </div>

            {/* Recent Collections */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{t('farmer.recentCollections')}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/reports/collections?farmerId=${id}`)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {t('common.viewAll')}
                </Button>
              </div>

              {collections.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t('farmer.noCollections')}
                </p>
              ) : (
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <div
                      key={collection.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">
                            {formatDate(collection.date)}
                          </span>
                          <Badge size="sm" variant={collection.shift === 'MORNING' ? 'info' : 'warning'}>
                            {collection.shift === 'MORNING' ? 'AM' : 'PM'}
                          </Badge>
                          <Badge size="sm" variant={isDatePaid(collection.date) ? 'success' : 'error'}>
                            {isDatePaid(collection.date) ? t('reports.paid') : t('reports.unpaid')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {collection.quantity}L @ {formatCurrency(collection.ratePerLiter)}/L
                        </p>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(collection.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </>
        )}
      </div>
    </AppShell>
  )
}
