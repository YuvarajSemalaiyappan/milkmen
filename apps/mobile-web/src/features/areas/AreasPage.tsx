import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Users } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useAreas } from '@/hooks'
import { useAuthStore } from '@/store'

export function AreasPage() {
  const { t } = useTranslation()
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { areas, isLoading } = useAreas(routeId)

  const isManager = user?.role === 'MANAGER' || user?.role === 'OWNER'

  return (
    <AppShell
      title={t('areas.title')}
      showBack
      rightAction={
        isManager ? (
          <Button
            size="sm"
            onClick={() => navigate(`/routes/${routeId}/areas/add`)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('common.add')}
          </Button>
        ) : undefined
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : areas.length === 0 ? (
          <EmptyState
            icon={<MapPin className="w-12 h-12" />}
            title={t('areas.noAreas')}
            description={t('areas.addFirst')}
            action={
              isManager
                ? {
                    label: t('areas.addNew'),
                    onClick: () => navigate(`/routes/${routeId}/areas/add`)
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {areas.map((area) => (
              <Card
                key={area.id}
                className="cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                onClick={() => navigate(`/routes/${routeId}/areas/${area.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {area.name}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {area._count.routeFarmers} {t('areas.assignedFarmers').toLowerCase()}, {area._count.routeCustomers} {t('areas.assignedCustomers').toLowerCase()}
                    </p>
                  </div>
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
