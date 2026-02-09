import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useAreas } from '@/hooks'

const areaSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100)
})

type AreaFormData = z.infer<typeof areaSchema>

export function AddAreaPage() {
  const { t } = useTranslation()
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const { createArea } = useAreas(routeId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: '' }
  })

  const onSubmit = async (data: AreaFormData) => {
    if (!routeId) return
    try {
      setIsSubmitting(true)
      await createArea({ routeId, name: data.name })
      navigate(`/routes/${routeId}/areas`)
    } catch (error) {
      console.error('Failed to add area:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell title={t('areas.addNew')} showBack>
      <div className="px-4 pt-5 pb-4">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('areas.name')}
              placeholder={t('areas.namePlaceholder')}
              error={errors.name?.message}
              {...register('name')}
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
