import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Trash2,
  User,
  Calendar,
  Clock,
  IndianRupee,
  Droplets,
  AlertCircle
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useCollections, useFarmers } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalCollection, LocalFarmer } from '@/types'

const collectionSchema = z.object({
  quantity: z.number().min(0.1, 'Quantity must be at least 0.1'),
  fatContent: z.number().min(0).max(15).optional(),
  ratePerLiter: z.number().min(1, 'Rate must be greater than 0'),
  notes: z.string().optional()
})

type CollectionFormData = z.infer<typeof collectionSchema>

export function CollectionDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { collections, updateCollection, deleteCollection } = useCollections()
  const { getFarmer } = useFarmers()

  const [collection, setCollection] = useState<LocalCollection | null>(null)
  const [farmer, setFarmer] = useState<LocalFarmer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema)
  })

  const watchQuantity = watch('quantity')
  const watchRate = watch('ratePerLiter')
  const calculatedTotal = (watchQuantity || 0) * (watchRate || 0)

  useEffect(() => {
    if (id) {
      loadCollection()
    }
  }, [id, collections])

  const loadCollection = async () => {
    if (!id) return
    const found = collections.find(c => c.id === id)
    if (found) {
      setCollection(found)
      reset({
        quantity: found.data.quantity,
        fatContent: found.data.fatContent,
        ratePerLiter: found.data.ratePerLiter,
        notes: found.data.notes || ''
      })

      // Load farmer details
      const farmerData = await getFarmer(found.data.farmerId)
      setFarmer(farmerData)
    }
  }

  const onSubmit = async (data: CollectionFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateCollection(id, {
        quantity: data.quantity,
        fatContent: data.fatContent,
        ratePerLiter: data.ratePerLiter,
        notes: data.notes || undefined
      })
      setIsEditing(false)
      loadCollection()
    } catch (error) {
      console.error('Failed to update collection:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await deleteCollection(id)
      navigate('/collect')
    } catch (error) {
      console.error('Failed to delete collection:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!collection) {
    return (
      <AppShell title={t('collection.editCollection')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  const hasRateBeenEdited = collection.data.rateEditedAt && collection.data.originalRate

  return (
    <AppShell
      title={isEditing ? t('collection.editCollection') : t('collection.details')}
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
                label={t('collection.quantity')}
                type="number"
                step="0.01"
                min="0.1"
                error={errors.quantity?.message}
                {...register('quantity', { valueAsNumber: true })}
              />

              <Input
                label={t('collection.fatContent')}
                type="number"
                step="0.1"
                min="0"
                max="15"
                placeholder={t('common.optional')}
                error={errors.fatContent?.message}
                {...register('fatContent', { valueAsNumber: true })}
              />

              <Input
                label={t('collection.ratePerLiter')}
                type="number"
                step="0.01"
                min="1"
                leftIcon={<span className="text-gray-500">₹</span>}
                error={errors.ratePerLiter?.message}
                {...register('ratePerLiter', { valueAsNumber: true })}
              />

              {/* Calculated Total */}
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('collection.totalAmount')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculatedTotal)}
                </p>
              </div>

              <Input
                label={t('common.notes')}
                placeholder={t('common.optional')}
                error={errors.notes?.message}
                {...register('notes')}
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
            {/* Farmer Info */}
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{t('collection.selectFarmer')}</p>
                  <p className="font-semibold text-gray-900">{farmer?.data.name || t('common.unknown')}</p>
                  {farmer?.data.village && (
                    <p className="text-sm text-gray-500">{farmer.data.village}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => farmer && navigate(`/farmers/${farmer.id}`)}
                >
                  {t('common.view')}
                </Button>
              </div>
            </Card>

            {/* Collection Details */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">{t('collection.details')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{t('common.date')}</span>
                  </div>
                  <span className="font-medium">{formatDate(collection.data.date)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{t('collection.shift')}</span>
                  </div>
                  <Badge variant={collection.data.shift === 'MORNING' ? 'info' : 'warning'}>
                    {t(`shifts.${collection.data.shift.toLowerCase()}`)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Droplets className="w-4 h-4" />
                    <span>{t('common.quantity')}</span>
                  </div>
                  <span className="font-medium">{Number(collection.data.quantity).toFixed(1)} L</span>
                </div>

                {collection.data.fatContent && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="w-4 h-4 text-center text-xs font-bold">%</span>
                      <span>{t('collection.fatContent')}</span>
                    </div>
                    <span className="font-medium">{Number(collection.data.fatContent).toFixed(1)}%</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <IndianRupee className="w-4 h-4" />
                    <span>{t('common.rate')}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(collection.data.ratePerLiter)}/L</span>
                </div>

                {collection.data.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-500">{t('common.notes')}</p>
                    <p className="text-gray-700">{collection.data.notes}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Total Amount */}
            <Card className="bg-green-50 border-green-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('collection.totalAmount')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(collection.data.totalAmount)}
                </p>
              </div>
            </Card>

            {/* Rate Edit Tracking */}
            {hasRateBeenEdited && (
              <Card className="bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">{t('collection.rateEdited')}</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {t('collection.originalRate')}: {formatCurrency(collection.data.originalRate!)}/L
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {t('collection.editedOn')} {formatDate(collection.data.rateEditedAt!)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Delete Button */}
            <div className="pt-4">
              {showDeleteConfirm ? (
                <Card className="bg-red-50 border-red-200">
                  <p className="text-sm text-red-700 mb-3">
                    {t('collection.confirmDelete')}
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
                  {t('collection.deleteCollection')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
