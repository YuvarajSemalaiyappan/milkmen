import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Trash2,
  UserCircle,
  Calendar,
  Clock,
  IndianRupee,
  Droplets,
  AlertCircle,
  CheckCircle,
  XCircle,
  MinusCircle
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useDeliveries, useCustomers } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalDelivery, LocalCustomer, DeliveryStatus } from '@/types'

const deliverySchema = z.object({
  quantity: z.number().min(0.1, 'Quantity must be at least 0.1'),
  ratePerLiter: z.number().min(1, 'Rate must be greater than 0'),
  status: z.enum(['DELIVERED', 'SKIPPED', 'CANCELLED']),
  notes: z.string().optional()
})

type DeliveryFormData = z.infer<typeof deliverySchema>

export function DeliveryDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deliveries, updateDelivery, deleteDelivery } = useDeliveries()
  const { getCustomer } = useCustomers()

  const [delivery, setDelivery] = useState<LocalDelivery | null>(null)
  const [customer, setCustomer] = useState<LocalCustomer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliverySchema)
  })

  const watchQuantity = watch('quantity')
  const watchRate = watch('ratePerLiter')
  const watchStatus = watch('status')
  const calculatedTotal = (watchQuantity || 0) * (watchRate || 0)

  useEffect(() => {
    if (id) {
      loadDelivery()
    }
  }, [id, deliveries])

  const loadDelivery = async () => {
    if (!id) return
    const found = deliveries.find(d => d.id === id)
    if (found) {
      setDelivery(found)
      reset({
        quantity: found.data.quantity,
        ratePerLiter: found.data.ratePerLiter,
        status: found.data.status,
        notes: found.data.notes || ''
      })

      // Load customer details
      const customerData = await getCustomer(found.data.customerId)
      setCustomer(customerData)
    }
  }

  const onSubmit = async (data: DeliveryFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateDelivery(id, {
        quantity: data.quantity,
        ratePerLiter: data.ratePerLiter,
        status: data.status,
        notes: data.notes || undefined
      })
      setIsEditing(false)
      loadDelivery()
    } catch (error) {
      console.error('Failed to update delivery:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await deleteDelivery(id)
      navigate('/deliver')
    } catch (error) {
      console.error('Failed to delete delivery:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusIcon = (status: DeliveryStatus) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'SKIPPED':
        return <MinusCircle className="w-5 h-5 text-yellow-600" />
      case 'CANCELLED':
        return <XCircle className="w-5 h-5 text-red-600" />
    }
  }

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success">{t('delivery.delivered')}</Badge>
      case 'SKIPPED':
        return <Badge variant="warning">{t('delivery.skipped')}</Badge>
      case 'CANCELLED':
        return <Badge variant="error">{t('delivery.cancelled')}</Badge>
    }
  }

  if (!delivery) {
    return (
      <AppShell title={t('delivery.editDelivery')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  const hasRateBeenEdited = delivery.data.rateEditedAt && delivery.data.originalRate

  return (
    <AppShell
      title={isEditing ? t('delivery.editDelivery') : t('delivery.details')}
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
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('delivery.status')}
                </label>
                <div className="flex gap-2">
                  {(['DELIVERED', 'SKIPPED', 'CANCELLED'] as DeliveryStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        watchStatus === status
                          ? status === 'DELIVERED' ? 'border-green-600 bg-green-50 text-green-600' :
                            status === 'SKIPPED' ? 'border-yellow-600 bg-yellow-50 text-yellow-600' :
                            'border-red-600 bg-red-50 text-red-600'
                          : 'border-gray-200 text-gray-700'
                      }`}
                      onClick={() => setValue('status', status)}
                    >
                      {t(`delivery.${status.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={t('collection.quantity')}
                type="number"
                step="0.1"
                min="0.1"
                error={errors.quantity?.message}
                {...register('quantity', { valueAsNumber: true })}
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
            {/* Customer Info */}
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-pink-100 rounded-lg">
                  <UserCircle className="w-6 h-6 text-pink-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{t('delivery.selectCustomer')}</p>
                  <p className="font-semibold text-gray-900">{customer?.data.name || t('common.unknown')}</p>
                  {customer?.data.address && (
                    <p className="text-sm text-gray-500">{customer.data.address}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => customer && navigate(`/customers/${customer.id}`)}
                >
                  {t('common.view')}
                </Button>
              </div>
            </Card>

            {/* Delivery Status */}
            <Card className={
              delivery.data.status === 'DELIVERED' ? 'bg-green-50 border-green-200' :
              delivery.data.status === 'SKIPPED' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }>
              <div className="flex items-center justify-center gap-3">
                {getStatusIcon(delivery.data.status)}
                <span className="text-lg font-semibold">
                  {t(`delivery.${delivery.data.status.toLowerCase()}`)}
                </span>
              </div>
            </Card>

            {/* Delivery Details */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">{t('delivery.details')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{t('common.date')}</span>
                  </div>
                  <span className="font-medium">{formatDate(delivery.data.date)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{t('collection.shift')}</span>
                  </div>
                  <Badge variant={delivery.data.shift === 'MORNING' ? 'info' : 'warning'}>
                    {t(`shifts.${delivery.data.shift.toLowerCase()}`)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Droplets className="w-4 h-4" />
                    <span>{t('common.quantity')}</span>
                  </div>
                  <span className="font-medium">{Number(delivery.data.quantity).toFixed(1)} L</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <IndianRupee className="w-4 h-4" />
                    <span>{t('common.rate')}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(delivery.data.ratePerLiter)}/L</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-xs">{t('delivery.type')}</span>
                  </div>
                  <Badge variant={delivery.data.isSubscription ? 'info' : 'default'}>
                    {delivery.data.isSubscription ? t('delivery.subscriptionDelivery') : t('delivery.extraDelivery')}
                  </Badge>
                </div>

                {delivery.data.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-500">{t('common.notes')}</p>
                    <p className="text-gray-700">{delivery.data.notes}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Total Amount */}
            <Card className="bg-green-50 border-green-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">{t('collection.totalAmount')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(delivery.data.totalAmount)}
                </p>
              </div>
            </Card>

            {/* Rate Edit Tracking */}
            {hasRateBeenEdited && (
              <Card className="bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">{t('delivery.rateEdited')}</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {t('collection.originalRate')}: {formatCurrency(delivery.data.originalRate!)}/L
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {t('collection.editedOn')} {formatDate(delivery.data.rateEditedAt!)}
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
                    {t('delivery.confirmDelete')}
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
                  {t('delivery.deleteDelivery')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
