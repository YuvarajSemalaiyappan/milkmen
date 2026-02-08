import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
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
  ChevronRight
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useFarmers, useCollections } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalFarmer, LocalCollection } from '@/types'

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  village: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0')
})

type FarmerFormData = z.infer<typeof farmerSchema>

export function FarmerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getFarmer, updateFarmer, deleteFarmer } = useFarmers()
  const { getCollectionsByFarmer } = useCollections()

  const [farmer, setFarmer] = useState<LocalFarmer | null>(null)
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema)
  })

  useEffect(() => {
    if (id) {
      loadFarmer()
      loadCollections()
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
        defaultRate: data.data.defaultRate
      })
    }
  }

  const loadCollections = async () => {
    if (!id) return
    const data = await getCollectionsByFarmer(id)
    setCollections(data.slice(0, 10)) // Last 10 collections
  }

  const onSubmit = async (data: FarmerFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateFarmer(id, {
        name: data.name,
        phone: data.phone || undefined,
        village: data.village || undefined,
        defaultRate: data.defaultRate
      })
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

  if (!farmer) {
    return (
      <AppShell title={t('farmer.details')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  const totalCollections = collections.reduce(
    (sum, c) => sum + Number(c.data.quantity),
    0
  )
  const totalAmount = collections.reduce(
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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-center">
                  <TrendingUp className="w-6 h-6 mx-auto text-primary-500 mb-1" />
                  <p className="text-2xl font-bold">{totalCollections.toFixed(1)}L</p>
                  <p className="text-xs text-gray-500">{t('farmer.totalCollected')}</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <IndianRupee className="w-6 h-6 mx-auto text-green-500 mb-1" />
                  <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                  <p className="text-xs text-gray-500">{t('farmer.totalValue')}</p>
                </div>
              </Card>
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
                onClick={() => navigate(`/payments/add?farmerId=${id}`)}
                fullWidth
              >
                {t('payment.payFarmer')}
              </Button>
            </div>

            {/* Delete Button */}
            <div className="pt-4">
              {showDeleteConfirm ? (
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
          </>
        )}
      </div>
    </AppShell>
  )
}
