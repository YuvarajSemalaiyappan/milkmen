import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useCustomers } from '@/hooks'

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  subscriptionQty: z.number().optional(),
  subscriptionAM: z.boolean(),
  subscriptionPM: z.boolean()
})

type CustomerFormData = z.infer<typeof customerSchema>

export function AddCustomerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addCustomer } = useCustomers()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      subscriptionQty: undefined,
      subscriptionAM: true,
      subscriptionPM: false
    }
  })

  const subscriptionQty = watch('subscriptionQty')

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setIsSubmitting(true)
      await addCustomer({
        name: data.name,
        phone: data.phone || undefined,
        address: data.address || undefined,
        defaultRate: data.defaultRate,
        subscriptionQty: data.subscriptionQty || undefined,
        subscriptionAM: data.subscriptionAM,
        subscriptionPM: data.subscriptionPM
      })
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

            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('customer.subscription')}
              </h3>

              <Input
                label={t('customer.dailyQty')}
                type="number"
                step="0.1"
                placeholder="Daily quantity (optional)"
                error={errors.subscriptionQty?.message}
                {...register('subscriptionQty', { valueAsNumber: true })}
              />

              {subscriptionQty && subscriptionQty > 0 && (
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      {...register('subscriptionAM')}
                    />
                    <span className="text-gray-700 dark:text-gray-200">
                      {t('customer.morningDelivery')}
                    </span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      {...register('subscriptionPM')}
                    />
                    <span className="text-gray-700 dark:text-gray-200">
                      {t('customer.eveningDelivery')}
                    </span>
                  </label>
                </div>
              )}
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
