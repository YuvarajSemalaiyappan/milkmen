import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Users, Phone, MapPin, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useFarmers } from '@/hooks'
import { formatCurrency } from '@/utils'
import type { LocalFarmer } from '@/types'

export function FarmersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeFarmers, searchFarmers, isLoading } = useFarmers()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredFarmers, setFilteredFarmers] = useState<LocalFarmer[]>([])

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery) {
        const results = await searchFarmers(searchQuery)
        setFilteredFarmers(results)
      } else {
        setFilteredFarmers(activeFarmers)
      }
    }
    doSearch()
  }, [searchQuery, activeFarmers, searchFarmers])

  const farmers = searchQuery ? filteredFarmers : activeFarmers

  return (
    <AppShell
      title={t('farmer.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/farmers/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Search */}
        <Input
          placeholder={t('farmer.searchFarmers')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('common.loading')}...
          </div>
        )}

        {/* Farmers List */}
        {!isLoading && farmers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title={searchQuery ? t('farmer.noResults') : t('farmer.noFarmers')}
            description={searchQuery ? t('farmer.tryDifferentSearch') : t('farmer.addFirst')}
            action={
              !searchQuery
                ? {
                    label: t('farmer.addNew'),
                    onClick: () => navigate('/farmers/add')
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {farmers.map((farmer) => (
              <Card
                key={farmer.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/farmers/${farmer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {farmer.data.name}
                      </h3>
                      {farmer.syncStatus === 'PENDING' && (
                        <Badge size="sm" variant="warning">Pending</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {farmer.data.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {farmer.data.phone}
                        </span>
                      )}
                      {farmer.data.village && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {farmer.data.village}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {t('farmer.rate')}: {formatCurrency(farmer.data.defaultRate)}/L
                      </span>
                      {farmer.data.balance > 0 && (
                        <Badge variant="warning">
                          {t('farmer.due')}: {formatCurrency(farmer.data.balance)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Farmer Count */}
        {!isLoading && farmers.length > 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {farmers.length} {t('farmer.farmersFound')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
