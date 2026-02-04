import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Card, Input, Button, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SubscriptionBadge, Badge } from '@/components/ui'
import { businessesApi } from '@/services'
import { format, differenceInDays } from 'date-fns'
import type { Business } from '@/types'

type FilterStatus = 'all' | 'active' | 'expiring' | 'expired' | 'inactive'

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  useEffect(() => {
    loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    try {
      const response = await businessesApi.list()
      setBusinesses(response.data)
    } catch (error) {
      console.error('Failed to load businesses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getFilteredBusinesses = () => {
    let filtered = businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.phone.includes(search)
    )

    if (filterStatus !== 'all') {
      filtered = filtered.filter((b) => {
        const status = b.subscription?.status
        const endDate = b.subscription?.endDate ? new Date(b.subscription.endDate) : null
        const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : 0

        switch (filterStatus) {
          case 'active':
            return status === 'ACTIVE' && daysRemaining > 7
          case 'expiring':
            return status === 'ACTIVE' && daysRemaining <= 7 && daysRemaining > 0
          case 'expired':
            return status === 'EXPIRED'
          case 'inactive':
            return status === 'INACTIVE'
          default:
            return true
        }
      })
    }

    return filtered
  }

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null
    const days = differenceInDays(new Date(endDate), new Date())
    return days
  }

  const filters: { value: FilterStatus; label: string; icon: typeof CheckCircle }[] = [
    { value: 'all', label: 'All', icon: CheckCircle },
    { value: 'active', label: 'Active', icon: CheckCircle },
    { value: 'expiring', label: 'Expiring Soon', icon: AlertTriangle },
    { value: 'expired', label: 'Expired', icon: XCircle },
    { value: 'inactive', label: 'Inactive', icon: Clock }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const filteredBusinesses = getFilteredBusinesses()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 mt-1">Manage business subscriptions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            variant={filterStatus === filter.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <Input
          placeholder="Search by business name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />
      </Card>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Business</TableHeader>
              <TableHeader>Plan</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>End Date</TableHeader>
              <TableHeader>Days Left</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBusinesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-gray-500">No subscriptions found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredBusinesses.map((business) => {
                const daysRemaining = getDaysRemaining(business.subscription?.endDate)
                return (
                  <TableRow key={business.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{business.name}</p>
                      <p className="text-xs text-gray-500">{business.phone}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">
                        {business.subscription?.plan || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SubscriptionBadge status={business.subscription?.status || 'INACTIVE'} />
                    </TableCell>
                    <TableCell>
                      {business.subscription?.endDate
                        ? format(new Date(business.subscription.endDate), 'dd MMM yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {daysRemaining !== null ? (
                        <span
                          className={
                            daysRemaining <= 0
                              ? 'text-red-600 font-medium'
                              : daysRemaining <= 7
                              ? 'text-yellow-600 font-medium'
                              : 'text-gray-900'
                          }
                        >
                          {daysRemaining <= 0 ? 'Expired' : `${daysRemaining} days`}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/businesses/${business.id}`)}
                      >
                        {business.subscription?.status === 'ACTIVE' ? 'Manage' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
