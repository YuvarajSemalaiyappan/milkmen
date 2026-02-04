import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useRoutes } from '@/hooks'

const routeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional()
})

type RouteFormData = z.infer<typeof routeSchema>

export function AddRoutePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { createRoute } = useRoutes()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  })

  const onSubmit = async (data: RouteFormData) => {
    try {
      setIsSubmitting(true)
      await createRoute({
        name: data.name,
        description: data.description || undefined
      })
      navigate('/routes')
    } catch (error) {
      console.error('Failed to add route:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell title={t('routes.addNew')} showBack>
      <div className="px-4 pt-5 pb-4">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('routes.name')}
              placeholder={t('routes.namePlaceholder')}
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label={t('routes.description')}
              placeholder={t('routes.descriptionPlaceholder')}
              error={errors.description?.message}
              {...register('description')}
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
