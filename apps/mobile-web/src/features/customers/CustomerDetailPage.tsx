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
import { useCustomers, useDeliveries, usePayments, useRoutes, useAreas } from '@/hooks'
import { routesApi } from '@/services/api'
import { formatCurrency, formatDate, isEntryPaid } from '@/utils'
import type { Customer, Delivery, ApiResponse } from '@/types'
import type { PaidPeriodPayment } from '@/utils/paymentPeriod'

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  subscriptionQtyAM: z.preprocess((v) => (v === '' || Number.isNaN(v) ? undefined : v), z.number().optional()),
  subscriptionQtyPM: z.preprocess((v) => (v === '' || Number.isNaN(v) ? undefined : v), z.number().optional())
})

type CustomerFormData = z.infer<typeof customerSchema>

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getCustomer, updateCustomer, deleteCustomer } = useCustomers()
  const { getDeliveriesByCustomer } = useDeliveries({ skipInitialFetch: true })
  const { getPaymentsByCustomer } = usePayments({ skipInitialFetch: true })
  const { routes } = useRoutes()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null)
  const [paidPayments, setPaidPayments] = useState<PaidPeriodPayment[]>([])
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
      loadLastPaymentDate()
    }
  }, [id])

  const loadCustomer = async () => {
    if (!id) return
    const data = await getCustomer(id)
    if (data) {
      setCustomer(data)
      reset({
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        defaultRate: data.defaultRate,
        subscriptionQtyAM: data.subscriptionQtyAM || undefined,
        subscriptionQtyPM: data.subscriptionQtyPM || undefined
      })

      // Load existing route/area assignment from server response
      const customerDetail = data as Customer & { routeCustomers?: Array<{ routeId: string; areaId?: string }> }
      if (customerDetail.routeCustomers && customerDetail.routeCustomers.length > 0) {
        setSelectedRouteId(customerDetail.routeCustomers[0].routeId)
        setSelectedAreaId(customerDetail.routeCustomers[0].areaId || null)
      }
    }
  }

  const loadDeliveries = async () => {
    if (!id) return
    const data = await getDeliveriesByCustomer(id, undefined, undefined, 10)
    setDeliveries(data)
  }

  const loadLastPaymentDate = async () => {
    if (!id) return
    const payments = await getPaymentsByCustomer(id)
    if (payments.length === 0) {
      setLastPaymentDate(null)
      setPaidPayments([])
      return
    }

    const toDateOnly = (d: string) => d.slice(0, 10)
    const withPeriod = payments
      .filter((p) => p.periodFromDate && p.periodToDate)
      .map((p) => ({
        periodFromDate: p.periodFromDate,
        periodToDate: p.periodToDate,
        periodFromShift: p.periodFromShift,
        periodToShift: p.periodToShift,
        createdAt: p.createdAt
      })) as PaidPeriodPayment[]

    setPaidPayments(withPeriod)

    if (withPeriod.length === 0) {
      setLastPaymentDate(null)
      return
    }

    const paidTill = withPeriod.reduce(
      (max, p) => (toDateOnly(p.periodToDate!) > max ? toDateOnly(p.periodToDate!) : max),
      toDateOnly(withPeriod[0].periodToDate!)
    )
    setLastPaymentDate(paidTill)
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
        subscriptionQtyAM: data.subscriptionQtyAM || undefined,
        subscriptionQtyPM: data.subscriptionQtyPM || undefined
      })

      // Update route assignment if changed
      if (selectedRouteId) {
        try {
          await routesApi.assignCustomers(selectedRouteId, [id], undefined, selectedAreaId ? { [id]: selectedAreaId } : undefined)
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

  const isDeliveryPaid = (d: Delivery) =>
    isEntryPaid(d.date, d.shift, d.createdAt, paidPayments)

  const unpaidDeliveries = deliveries.filter((d) => !isDeliveryPaid(d))
  const unpaidQty = unpaidDeliveries.reduce(
    (sum, d) => sum + Number(d.quantity),
    0
  )
  const unpaidAmount = unpaidDeliveries.reduce(
    (sum, d) => sum + Number(d.totalAmount),
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
      title={isEditing ? t('customer.edit') : customer.name}
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
                      step="0.25"
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
                      step="0.25"
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
                  <h2 className="text-xl font-semibold">{customer.name}</h2>
                  <Badge
                    variant={customer.isActive ? 'success' : 'error'}
                  >
                    {customer.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>

                {customer.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${customer.phone}`} className="text-primary-600">
                      {customer.phone}
                    </a>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{customer.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <IndianRupee className="w-4 h-4" />
                  <span>
                    {t('customer.defaultRate')}: {formatCurrency(customer.defaultRate)}/L
                  </span>
                </div>
              </div>
            </Card>

            {/* Subscription Card */}
            {(customer.subscriptionQtyAM || customer.subscriptionQtyPM) && (
              <Card className="bg-blue-50 border-blue-200">
                <p className="text-sm text-gray-600 mb-2">{t('customer.subscription')}</p>
                <div className="flex flex-wrap gap-3">
                  {customer.subscriptionQtyAM && (
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="flex items-center gap-1">
                        <Sun className="w-3 h-3" /> AM
                      </Badge>
                      <span className="text-lg font-bold text-blue-600">
                        {customer.subscriptionQtyAM}L
                      </span>
                    </div>
                  )}
                  {customer.subscriptionQtyPM && (
                    <div className="flex items-center gap-2">
                      <Badge variant="info" className="flex items-center gap-1">
                        <Moon className="w-3 h-3" /> PM
                      </Badge>
                      <span className="text-lg font-bold text-blue-600">
                        {customer.subscriptionQtyPM}L
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Balance Card */}
            <Card className={customer.balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('customer.balance')}</p>
                  <p className={`text-2xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(customer.balance))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {customer.balance > 0 ? t('customer.theyOwe') : t('customer.settled')}
                  </p>
                </div>
              </div>
            </Card>

            {/* Unpaid Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-center">
                  <Package className="w-6 h-6 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-bold">{unpaidQty.toFixed(1)}L</p>
                  <p className="text-xs text-gray-500">{t('customer.unpaidQty')}</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <IndianRupee className="w-6 h-6 mx-auto text-red-500 mb-1" />
                  <p className="text-2xl font-bold">{formatCurrency(unpaidAmount)}</p>
                  <p className="text-xs text-gray-500">{t('customer.unpaidAmount')}</p>
                </div>
              </Card>
            </div>

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
                onClick={() => navigate(`/payments/add?type=customer&customerId=${id}`)}
                fullWidth
              >
                {t('payment.receivePayment')}
              </Button>
            </div>

            {/* Delete / Activate Button */}
            <div>
              {!customer.isActive ? (
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
                            {formatDate(delivery.date)}
                          </span>
                          <Badge size="sm" variant={delivery.shift === 'MORNING' ? 'warning' : 'info'}>
                            {delivery.shift === 'MORNING' ? 'AM' : 'PM'}
                          </Badge>
                          {getStatusBadge(delivery.status)}
                          <Badge size="sm" variant={isDeliveryPaid(delivery) ? 'success' : 'error'}>
                            {isDeliveryPaid(delivery) ? t('reports.paid') : t('reports.unpaid')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {delivery.quantity}L @ {formatCurrency(delivery.ratePerLiter)}/L
                        </p>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(delivery.totalAmount)}
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
