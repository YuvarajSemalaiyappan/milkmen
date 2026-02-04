import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Users, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useRoutes } from '@/hooks'

export function RoutesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { routes, isLoading, isManager } = useRoutes()

  return (
    <AppShell
      title={t('routes.title')}
      showBack
      rightAction={
        isManager ? (
          <Button
            size="sm"
            onClick={() => navigate('/routes/add')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('common.add')}
          </Button>
        ) : undefined
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('common.loading')}...
          </div>
        )}

        {!isLoading && routes.length === 0 ? (
          <EmptyState
            icon={<MapPin className="w-16 h-16" />}
            title={t('routes.noRoutes')}
            description={t('routes.addFirst')}
            action={
              isManager
                ? {
                    label: t('routes.addNew'),
                    onClick: () => navigate('/routes/add')
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <Card
                key={route.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/routes/${route.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {route.name}
                      </h3>
                      {!route.isActive && (
                        <Badge size="sm" variant="error">{t('settings.inactive')}</Badge>
                      )}
                    </div>

                    {route.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {route.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {route._count.userRoutes} {t('routes.staff')}
                      </span>
                      <span>
                        {route._count.routeFarmers} {t('nav.farmers')}
                      </span>
                      <span>
                        {route._count.routeCustomers} {t('nav.customers')}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && routes.length > 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {routes.length} {t('routes.routesFound')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
