import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useFarmers, useRoutes, useAreas } from '@/hooks'
import { routesApi } from '@/services/api'
import { syncService } from '@/services/syncService'
import { db } from '@/db/localDb'

const farmerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  village: z.string().optional(),
  defaultRate: z.number().min(1, 'Rate must be greater than 0'),
  collectAM: z.boolean(),
  collectPM: z.boolean()
})

type FarmerFormData = z.infer<typeof farmerSchema>

export function AddFarmerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addFarmer } = useFarmers()
  const { routes } = useRoutes()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const { areas } = useAreas(selectedRouteId)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors }
  } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: '',
      phone: '',
      village: '',
      defaultRate: 42, // Default rate
      collectAM: true,
      collectPM: false
    }
  })

  const collectAM = useWatch({ control, name: 'collectAM' })
  const collectPM = useWatch({ control, name: 'collectPM' })

  const onSubmit = async (data: FarmerFormData) => {
    try {
      setIsSubmitting(true)
      const result = await addFarmer({
        name: data.name,
        phone: data.phone || undefined,
        village: data.village || undefined,
        defaultRate: data.defaultRate,
        collectAM: data.collectAM,
        collectPM: data.collectPM
      })

      // Assign to route if selected - wait for sync to get server ID
      if (selectedRouteId && result) {
        try {
          await syncService.waitForProcessing()
          const synced = await db.farmers.where('localId').equals(result.localId).first()
          const serverId = synced?.id
          if (serverId && !serverId.startsWith('local_')) {
            await routesApi.assignFarmers(selectedRouteId, [serverId], undefined, selectedAreaId ? { [serverId]: selectedAreaId } : undefined)
          }
        } catch {
          // Non-critical: farmer created but route assignment failed
        }
      }

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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {t('farmer.collectionShift')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-primary-600 rounded"
                    checked={collectAM}
                    onChange={(e) => setValue('collectAM', e.target.checked)}
                  />
                  <Sun className="w-5 h-5 text-yellow-500" />
                  <span>{t('common.morning')} (AM)</span>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-primary-600 rounded"
                    checked={collectPM}
                    onChange={(e) => setValue('collectPM', e.target.checked)}
                  />
                  <Moon className="w-5 h-5 text-blue-500" />
                  <span>{t('common.evening')} (PM)</span>
                </label>
              </div>
            </div>

            {/* Route / Area Assignment */}
            {routes.length > 0 && (
              <div className="border-t dark:border-gray-700 pt-4 mt-4 space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {t('farmer.selectRoute')}
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
                      {t('farmer.selectArea')}
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
