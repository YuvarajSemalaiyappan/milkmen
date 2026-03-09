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
import { db } from '@/db/localDb'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalFarmer, LocalCollection } from '@/types'

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  village: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  collectAM: z.boolean(),
  collectPM: z.boolean()
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

  const [farmer, setFarmer] = useState<LocalFarmer | null>(null)
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null)
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
        name: data.data.name,
        phone: data.data.phone || '',
        village: data.data.village || '',
        defaultRate: data.data.defaultRate,
        collectAM: data.data.collectAM ?? true,
        collectPM: data.data.collectPM ?? false
      })

      // Load existing route/area assignment
      const routeFarmer = await db.routeFarmers.where('farmerId').equals(id).first()
      if (routeFarmer) {
        setSelectedRouteId(routeFarmer.routeId)
        setSelectedAreaId(routeFarmer.areaId || null)
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
      const dates = payments.map((p) => p.data.periodToDate || p.data.date)
      dates.sort()
      setLastPaymentDate(dates[dates.length - 1])
    } else {
      setLastPaymentDate(null)
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
        collectPM: data.collectPM
      })

      // Update route assignment if changed
      if (selectedRouteId && !id.startsWith('local_')) {
        try {
          await routesApi.assignFarmers(selectedRouteId, [id], undefined, selectedAreaId ? { [id]: selectedAreaId } : undefined)
          // Update local DB so it shows on next load without sync
          const existing = await db.routeFarmers.where('farmerId').equals(id).first()
          if (existing) await db.routeFarmers.delete(existing.id)
          await db.routeFarmers.add({
            id: `${selectedRouteId}_${id}`,
            routeId: selectedRouteId,
            farmerId: id,
            areaId: selectedAreaId || undefined,
            sortOrder: existing?.sortOrder || 0
          })
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

  const unpaidCollections = collections.filter(
    (c) => !lastPaymentDate || c.data.date > lastPaymentDate
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
      title={isEditing ? t('farmer.edit') : farmer.data.name}
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
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-primary-600 rounded"
                      checked={collectAM}
                      onChange={(e) => setValue('collectAM', e.target.checked)}
                    />
                    <Sun className="w-5 h-5 text-yellow-500" />
                    <span>{t('common.morning')} (AM)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-primary-600 rounded"
                      checked={collectPM}
                      onChange={(e) => setValue('collectPM', e.target.checked)}
                    />
                    <Moon className="w-5 h-5 text-blue-500" />
                    <span>{t('common.evening')} (PM)</span>
                  </label>
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
                  <h2 className="text-xl font-semibold">{farmer.data.name}</h2>
                  <Badge
                    variant={farmer.data.isActive ? 'success' : 'error'}
                  >
                    {farmer.data.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>

                {farmer.data.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${farmer.data.phone}`} className="text-primary-600">
                      {farmer.data.phone}
                    </a>
                  </div>
                )}

                {farmer.data.village && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{farmer.data.village}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <IndianRupee className="w-4 h-4" />
                  <span>
                    {t('farmer.defaultRate')}: {formatCurrency(farmer.data.defaultRate)}/L
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  {farmer.data.collectAM && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Sun className="w-3 h-3" />
                      {t('common.morning')}
                    </span>
                  )}
                  {farmer.data.collectPM && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Moon className="w-3 h-3" />
                      {t('common.evening')}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Balance Card */}
            <Card className={farmer.data.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('farmer.balance')}</p>
                  <p className={`text-2xl font-bold ${farmer.data.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(farmer.data.balance))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {farmer.data.balance > 0 ? t('farmer.weOwe') : t('farmer.settled')}
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
              {!farmer.data.isActive ? (
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
                            {formatDate(collection.data.date)}
                          </span>
                          <Badge size="sm" variant={collection.data.shift === 'MORNING' ? 'info' : 'warning'}>
                            {collection.data.shift === 'MORNING' ? 'AM' : 'PM'}
                          </Badge>
                          <Badge size="sm" variant={lastPaymentDate && collection.data.date <= lastPaymentDate ? 'success' : 'error'}>
                            {lastPaymentDate && collection.data.date <= lastPaymentDate ? t('reports.paid') : t('reports.unpaid')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {collection.data.quantity}L @ {formatCurrency(collection.data.ratePerLiter)}/L
                        </p>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(collection.data.totalAmount)}
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
