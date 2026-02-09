import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, UserCircle, Phone, MapPin, ChevronRight, Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { EmptyState } from '@/components/common'
import { useCustomers } from '@/hooks'
import { formatCurrency } from '@/utils'
import type { LocalCustomer } from '@/types'

export function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeCustomers, searchCustomers, isLoading } = useCustomers()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<LocalCustomer[]>([])

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery) {
        const results = await searchCustomers(searchQuery)
        setFilteredCustomers(results)
      } else {
        setFilteredCustomers(activeCustomers)
      }
    }
    doSearch()
  }, [searchQuery, activeCustomers, searchCustomers])

  const customers = searchQuery ? filteredCustomers : activeCustomers

  return (
    <AppShell
      title={t('customer.title')}
      rightAction={
        <Button
          size="sm"
          onClick={() => navigate('/customers/add')}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('common.add')}
        </Button>
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Search */}
        <Input
          placeholder={t('customer.searchCustomers')}
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

        {/* Customers List */}
        {!isLoading && customers.length === 0 ? (
          <EmptyState
            icon={<UserCircle className="w-16 h-16" />}
            title={searchQuery ? t('customer.noResults') : t('customer.noCustomers')}
            description={searchQuery ? t('customer.tryDifferentSearch') : t('customer.addFirst')}
            action={
              !searchQuery
                ? {
                    label: t('customer.addNew'),
                    onClick: () => navigate('/customers/add')
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {customer.data.name}
                      </h3>
                      {customer.syncStatus === 'PENDING' && (
                        <Badge size="sm" variant="warning">Pending</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {customer.data.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.data.phone}
                        </span>
                      )}
                      {customer.data.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.data.address}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      {/* Subscription Info */}
                      {customer.data.subscriptionQtyAM && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Sun className="w-3 h-3" /> {customer.data.subscriptionQtyAM}L
                        </Badge>
                      )}
                      {customer.data.subscriptionQtyPM && (
                        <Badge variant="info" className="flex items-center gap-1">
                          <Moon className="w-3 h-3" /> {customer.data.subscriptionQtyPM}L
                        </Badge>
                      )}

                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(customer.data.defaultRate)}/L
                      </span>

                      {/* Balance Due */}
                      {customer.data.balance > 0 && (
                        <Badge variant="error">
                          {t('customer.due')}: {formatCurrency(customer.data.balance)}
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

        {/* Customer Count */}
        {!isLoading && customers.length > 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {customers.length} {t('customer.customersFound')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
