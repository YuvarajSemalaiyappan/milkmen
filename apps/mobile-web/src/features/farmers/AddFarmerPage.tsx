import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useFarmers } from '@/hooks'

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  village: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0')
})

type FarmerFormData = z.infer<typeof farmerSchema>

export function AddFarmerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addFarmer } = useFarmers()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: '',
      phone: '',
      village: '',
      defaultRate: 42 // Default rate
    }
  })

  const onSubmit = async (data: FarmerFormData) => {
    try {
      setIsSubmitting(true)
      await addFarmer({
        name: data.name,
        phone: data.phone || undefined,
        village: data.village || undefined,
        defaultRate: data.defaultRate
      })
      navigate('/farmers')
    } catch (error) {
      console.error('Failed to add farmer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell title={t('farmer.addNew')} showBack>
      <div className="px-4 pt-5 pb-4">
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
