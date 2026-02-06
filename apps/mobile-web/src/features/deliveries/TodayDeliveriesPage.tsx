import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Check,
  X,
  IndianRupee,
  Phone,
  MapPin,
  Sun,
  Moon,
  Plus
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { ShiftToggle, EmptyState } from '@/components/common'
import { useCustomers, useDeliveries, usePayments } from '@/hooks'
import { useAppStore } from '@/store'
import { formatCurrency, getToday } from '@/utils'
import type { LocalCustomer, LocalDelivery, Shift } from '@/types'

interface DeliveryItem {
  customer: LocalCustomer
  delivery?: LocalDelivery
  status: 'pending' | 'delivered' | 'skipped'
}

export function TodayDeliveriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentShift, setCurrentShift } = useAppStore()
  const { getSubscribedCustomers, activeCustomers } = useCustomers()
  const { todayDeliveries, addDelivery, updateDelivery } = useDeliveries()
  const { addPayment } = usePayments()

  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    loadDeliveryItems()
  }, [currentShift, todayDeliveries, activeCustomers])

  const loadDeliveryItems = async () => {
    setIsLoading(true)
    try {
      // Get subscribed customers for current shift
      const subscribedCustomers = await getSubscribedCustomers(currentShift)

      // Map customers to delivery items
      const items: DeliveryItem[] = subscribedCustomers.map((customer) => {
        const existingDelivery = todayDeliveries.find(
          (d) =>
            d.data.customerId === customer.id && d.data.shift === currentShift
        )

        return {
          customer,
          delivery: existingDelivery,
          status: existingDelivery
            ? existingDelivery.data.status === 'DELIVERED'
              ? 'delivered'
              : 'skipped'
            : 'pending'
        }
      })

      // Sort: pending first, then delivered, then skipped
      items.sort((a, b) => {
        const order = { pending: 0, delivered: 1, skipped: 2 }
        return order[a.status] - order[b.status]
      })

      setDeliveryItems(items)
    } catch (error) {
      console.error('Error loading delivery items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkDelivered = async (item: DeliveryItem) => {
    if (!item.customer.data.subscriptionQty) return
    setProcessingId(item.customer.id)

    try {
      if (item.delivery) {
        // Update existing delivery
        await updateDelivery(item.delivery.id, { status: 'DELIVERED' })
      } else {
        // Create new delivery
        await addDelivery({
          customerId: item.customer.id,
          date: getToday(),
          shift: currentShift,
          quantity: item.customer.data.subscriptionQty,
          ratePerLiter: item.customer.data.defaultRate,
          status: 'DELIVERED',
          isSubscription: true
        })
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkSkipped = async (item: DeliveryItem) => {
    setProcessingId(item.customer.id)

    try {
      if (item.delivery) {
        await updateDelivery(item.delivery.id, { status: 'SKIPPED' })
      } else {
        await addDelivery({
          customerId: item.customer.id,
          date: getToday(),
          shift: currentShift,
          quantity: 0,
          ratePerLiter: item.customer.data.defaultRate,
          status: 'SKIPPED',
          isSubscription: true
        })
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleReceivePayment = async (item: DeliveryItem) => {
    // Navigate to payment page with customer pre-selected
    navigate(`/payments/add?customerId=${item.customer.id}`)
  }

  const pendingCount = deliveryItems.filter((i) => i.status === 'pending').length
  const deliveredCount = deliveryItems.filter((i) => i.status === 'delivered').length
  const totalAmount = deliveryItems
    .filter((i) => i.status === 'delivered' && i.delivery)
    .reduce((sum, i) => sum + (i.delivery?.data.totalAmount || 0), 0)

  return (
    <AppShell
      title={t('delivery.todayTitle')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/deliver/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Shift Toggle */}
        <ShiftToggle
          value={currentShift}
          onChange={setCurrentShift}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
            <p className="text-xs text-gray-500">{t('delivery.pending')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
            <p className="text-xs text-gray-500">{t('delivery.delivered')}</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-primary-600">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-gray-500">{t('delivery.todayTotal')}</p>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}...
          </div>
        )}

        {/* Delivery Items */}
        {!isLoading && deliveryItems.length === 0 ? (
          <EmptyState
            icon={currentShift === 'MORNING' ? <Sun className="w-16 h-16" /> : <Moon className="w-16 h-16" />}
            title={t('delivery.noSubscriptions')}
            description={t('delivery.addSubscriptionHint')}
            action={{
              label: t('customer.addNew'),
              onClick: () => navigate('/customers/add')
            }}
          />
        ) : (
          <div className="space-y-3">
            {deliveryItems.map((item) => (
              <Card
                key={item.customer.id}
                className={
                  item.status === 'delivered'
                    ? 'bg-green-50 border-green-200'
                    : item.status === 'skipped'
                    ? 'bg-gray-50 border-gray-200'
                    : ''
                }
              >
                <div className="space-y-3">
                  {/* Customer Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.customer.data.name}</h3>
                        {item.status === 'delivered' && (
                          <Badge variant="success" size="sm">
                            <Check className="w-3 h-3 mr-1" />
                            {t('delivery.delivered')}
                          </Badge>
                        )}
                        {item.status === 'skipped' && (
                          <Badge variant="warning" size="sm">
                            {t('delivery.skipped')}
                          </Badge>
                        )}
                      </div>

                      {item.customer.data.address && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {item.customer.data.address}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-gray-700">
                          {item.customer.data.subscriptionQty}L @ {formatCurrency(item.customer.data.defaultRate)}/L
                        </span>
                        <span className="font-semibold text-primary-600">
                          = {formatCurrency(
                            (item.customer.data.subscriptionQty || 0) *
                              item.customer.data.defaultRate
                          )}
                        </span>
                      </div>
                    </div>

                    {item.customer.data.phone && (
                      <a
                        href={`tel:${item.customer.data.phone}`}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  {/* Balance Due */}
                  {item.customer.data.balance > 0 && (
                    <div className="bg-red-50 rounded-lg p-2 flex items-center justify-between">
                      <span className="text-sm text-red-700">
                        {t('customer.balanceDue')}: {formatCurrency(item.customer.data.balance)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReceivePayment(item)}
                        leftIcon={<IndianRupee className="w-3 h-3" />}
                      >
                        {t('payment.receive')}
                      </Button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {item.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleMarkDelivered(item)}
                        isLoading={processingId === item.customer.id}
                        fullWidth
                        leftIcon={<Check className="w-4 h-4" />}
                      >
                        {t('delivery.markDelivered')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleMarkSkipped(item)}
                        disabled={processingId === item.customer.id}
                        leftIcon={<X className="w-4 h-4" />}
                      >
                        {t('delivery.skip')}
                      </Button>
                    </div>
                  )}

                  {/* Edit delivered */}
                  {item.status === 'delivered' && item.delivery && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/deliver/edit/${item.delivery?.id}`)}
                        fullWidth
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReceivePayment(item)}
                        leftIcon={<IndianRupee className="w-3 h-3" />}
                      >
                        {t('payment.receive')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
