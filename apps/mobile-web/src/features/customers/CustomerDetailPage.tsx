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
  Package,
  Calendar,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useCustomers, useDeliveries, useRoutes, useAreas } from '@/hooks'
import { routesApi } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils'
import type { LocalCustomer, LocalDelivery } from '@/types'

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  subscriptionQtyAM: z.number().optional(),
  subscriptionQtyPM: z.number().optional()
})

type CustomerFormData = z.infer<typeof customerSchema>

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getCustomer, updateCustomer, deleteCustomer } = useCustomers()
  const { getDeliveriesByCustomer } = useDeliveries()
  const { routes } = useRoutes()

  const [customer, setCustomer] = useState<LocalCustomer | null>(null)
  const [deliveries, setDeliveries] = useState<LocalDelivery[]>([])
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
    watch,
    setValue,
    formState: { errors }
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema)
  })


  useEffect(() => {
    if (id) {
      loadCustomer()
      loadDeliveries()
    }
  }, [id])

  const loadCustomer = async () => {
    if (!id) return
    const data = await getCustomer(id)
    if (data) {
      setCustomer(data)
      reset({
        name: data.data.name,
        phone: data.data.phone || '',
        address: data.data.address || '',
        defaultRate: data.data.defaultRate,
        subscriptionQtyAM: data.data.subscriptionQtyAM || undefined,
        subscriptionQtyPM: data.data.subscriptionQtyPM || undefined
      })
    }
  }

  const loadDeliveries = async () => {
    if (!id) return
    const data = await getDeliveriesByCustomer(id)
    setDeliveries(data.slice(0, 10)) // Last 10 deliveries
  }

  const onSubmit = async (data: CustomerFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateCustomer(id, {
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        defaultRate: data.defaultRate,
        subscriptionQtyAM: data.subscriptionQtyAM,
        subscriptionQtyPM: data.subscriptionQtyPM
      })

      // Update route assignment if changed
      if (selectedRouteId && !id.startsWith('local_')) {
        try {
          await routesApi.assignCustomers(selectedRouteId, [id], undefined, selectedAreaId || undefined)
        } catch {
          // Non-critical
        }
      }

      setIsEditing(false)
      loadCustomer()
    } catch (error) {
      console.error('Failed to update customer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await deleteCustomer(id)
      navigate('/customers')
    } catch (error) {
      console.error('Failed to delete customer:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleActivate = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await updateCustomer(id, { isActive: true })
      loadCustomer()
    } catch (error) {
      console.error('Failed to activate customer:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!customer) {
    return (
      <AppShell title={t('customer.details')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  const totalDeliveries = deliveries.reduce(
    (sum, d) => sum + Number(d.data.quantity),
    0
  )
  const totalAmount = deliveries.reduce(
    (sum, d) => sum + Number(d.data.totalAmount),
    0
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge size="sm" variant="success">Delivered</Badge>
      case 'SKIPPED':
        return <Badge size="sm" variant="warning">Skipped</Badge>
      case 'CANCELLED':
        return <Badge size="sm" variant="error">Cancelled</Badge>
      default:
        return null
    }
  }

  return (
    <AppShell
      title={isEditing ? t('customer.edit') : customer.data.name}
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
                placeholder="Enter customer name"
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
                label={t('customer.address')}
                placeholder="Delivery address"
                error={errors.address?.message}
                {...register('address')}
              />

              <Input
                label={t('customer.defaultRate')}
                type="number"
                step="0.01"
                placeholder="Rate per liter"
                error={errors.defaultRate?.message}
                {...register('defaultRate', { valueAsNumber: true })}
              />

              {/* Subscription Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">{t('customer.subscription')}</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Sun className="w-5 h-5 text-yellow-500" />
                    <Input
                      label={t('customer.morningQty')}
                      type="number"
                      step="0.5"
                      placeholder="Morning quantity (liters)"
                      error={errors.subscriptionQtyAM?.message}
                      {...register('subscriptionQtyAM', { valueAsNumber: true })}
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Moon className="w-5 h-5 text-blue-500" />
                    <Input
                      label={t('customer.eveningQty')}
                      type="number"
                      step="0.5"
                      placeholder="Evening quantity (liters)"
                      error={errors.subscriptionQtyPM?.message}
                      {...register('subscriptionQtyPM', { valueAsNumber: true })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Route / Area Assignment */}
              {routes.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4 mt-4 space-y-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {t('customer.selectRoute')}
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
                        {t('customer.selectArea')}
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
            {/* Customer Info Card */}
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{customer.data.name}</h2>
                  <Badge
                    variant={customer.data.isActive ? 'success' : 'error'}
                  >
                    {customer.data.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>

                {customer.data.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${customer.data.phone}`} className="text-primary-600">
                      {customer.data.phone}
                    </a>
                  </div>
                )}

                {customer.data.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{customer.data.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <IndianRupee className="w-4 h-4" />
                  <span>
                    {t('customer.defaultRate')}: {formatCurrency(customer.data.defaultRate)}/L
                  </span>
                </div>
              </div>
            </Card>

            {/* Subscription Card */}
            {(customer.data.subscriptionQtyAM || customer.data.subscriptionQtyPM) && (
              <Card className="bg-blue-50 border-blue-200">
                <p className="text-sm text-gray-600 mb-2">{t('customer.subscription')}</p>
                <div className="flex flex-wrap gap-3">
                  {customer.data.subscriptionQtyAM && (
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Sun className="w-3 h-3" /> AM
                      </Badge>
                      <span className="text-lg font-bold text-blue-600">
                        {customer.data.subscriptionQtyAM}L
                      </span>
                    </div>
                  )}
                  {customer.data.subscriptionQtyPM && (
                    <div className="flex items-center gap-2">
                      <Badge variant="info" className="flex items-center gap-1">
                        <Moon className="w-3 h-3" /> PM
                      </Badge>
                      <span className="text-lg font-bold text-blue-600">
                        {customer.data.subscriptionQtyPM}L
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Balance Card */}
            <Card className={customer.data.balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('customer.balance')}</p>
                  <p className={`text-2xl font-bold ${customer.data.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(customer.data.balance))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {customer.data.balance > 0 ? t('customer.theyOwe') : t('customer.settled')}
                  </p>
                </div>
              </div>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-center">
                  <Package className="w-6 h-6 mx-auto text-primary-500 mb-1" />
                  <p className="text-2xl font-bold">{totalDeliveries.toFixed(1)}L</p>
                  <p className="text-xs text-gray-500">{t('customer.totalDelivered')}</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <IndianRupee className="w-6 h-6 mx-auto text-green-500 mb-1" />
                  <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                  <p className="text-xs text-gray-500">{t('customer.totalSales')}</p>
                </div>
              </Card>
            </div>

            {/* Recent Deliveries */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{t('customer.recentDeliveries')}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/reports/deliveries?customerId=${id}`)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {t('common.viewAll')}
                </Button>
              </div>

              {deliveries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t('customer.noDeliveries')}
                </p>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">
                            {formatDate(delivery.data.date)}
                          </span>
                          <Badge size="sm" variant={delivery.data.shift === 'MORNING' ? 'warning' : 'info'}>
                            {delivery.data.shift === 'MORNING' ? 'AM' : 'PM'}
                          </Badge>
                          {getStatusBadge(delivery.data.status)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {delivery.data.quantity}L @ {formatCurrency(delivery.data.ratePerLiter)}/L
                        </p>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(delivery.data.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate(`/deliver/add?customerId=${id}`)}
                fullWidth
              >
                {t('delivery.addNew')}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/payments/add?customerId=${id}`)}
                fullWidth
              >
                {t('payment.receivePayment')}
              </Button>
            </div>

            {/* Delete / Activate Button */}
            <div className="pt-4">
              {!customer.data.isActive ? (
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
                    {t('customer.deleteConfirm')}
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
                  {t('customer.delete')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
