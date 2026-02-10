import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useCustomers, useRoutes, useAreas } from '@/hooks'
import { routesApi } from '@/services/api'

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  subscriptionQtyAM: z.number().optional(),
  subscriptionQtyPM: z.number().optional()
})

type CustomerFormData = z.infer<typeof customerSchema>

export function AddCustomerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addCustomer } = useCustomers()
  const { routes } = useRoutes()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const { areas } = useAreas(selectedRouteId)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      defaultRate: 45,
      subscriptionQtyAM: undefined,
      subscriptionQtyPM: undefined
    }
  })

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setIsSubmitting(true)
      const result = await addCustomer({
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        defaultRate: data.defaultRate,
        subscriptionQtyAM: data.subscriptionQtyAM || undefined,
        subscriptionQtyPM: data.subscriptionQtyPM || undefined
      })

      // Assign to route if selected and customer has a server ID
      if (selectedRouteId && result && !result.id.startsWith('local_')) {
        try {
          await routesApi.assignCustomers(selectedRouteId, [result.id], undefined, selectedAreaId ? { [result.id]: selectedAreaId } : undefined)
        } catch {
          // Non-critical: customer created but route assignment failed
        }
      }

      navigate('/customers')
    } catch (error) {
      console.error('Failed to add customer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell title={t('customer.addNew')} showBack>
      <div className="px-4 pt-5 pb-4">
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
              label={t('common.address')}
              placeholder="Delivery address"
              error={errors.address?.message}
              {...register('address')}
            />

            <Input
              label={`${t('farmer.defaultRate')} (₹/L)`}
              type="number"
              step="0.01"
              placeholder="Rate per liter"
              error={errors.defaultRate?.message}
              {...register('defaultRate', { valueAsNumber: true })}
            />

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

            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('customer.subscription')}
              </h3>

              <div className="space-y-4">
                <Input
                  label={t('customer.morningQty')}
                  type="number"
                  step="0.1"
                  placeholder="Morning quantity (optional)"
                  error={errors.subscriptionQtyAM?.message}
                  {...register('subscriptionQtyAM', { valueAsNumber: true })}
                />

                <Input
                  label={t('customer.eveningQty')}
                  type="number"
                  step="0.1"
                  placeholder="Evening quantity (optional)"
                  error={errors.subscriptionQtyPM?.message}
                  {...register('subscriptionQtyPM', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                fullWidth
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                fullWidth
              >
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  )
}
