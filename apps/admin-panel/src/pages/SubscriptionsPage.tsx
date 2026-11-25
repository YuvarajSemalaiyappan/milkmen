import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, CheckCircle, XCircle, Clock, PauseCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, Input, Button, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SubscriptionBadge, Badge } from '@/components/ui'
import { businessesApi } from '@/services'
import { format, differenceInDays } from 'date-fns'
import type { Business } from '@/types'

// Filtering, search and paging run on the server (GET /api/admin/businesses), so every business
// is reachable, not only the first page. "Expired" includes plans past their end date.
type FilterStatus = 'all' | 'active' | 'expiring' | 'expired' | 'suspended' | 'inactive'

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await businessesApi.list({
        search: appliedSearch || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
        page
      })
      setBusinesses(response.data)
      setPagination(response.pagination)
      setError('')
    } catch (err) {
      console.error('Failed to load businesses:', err)
      setError('Failed to load subscriptions')
    } finally {
      setIsLoading(false)
    }
  }, [appliedSearch, filterStatus, page])

  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1)
      setAppliedSearch(search)
    }
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
    { value: 'suspended', label: 'Suspended', icon: PauseCircle },
    { value: 'inactive', label: 'Inactive', icon: Clock }
  ]

  if (isLoading && businesses.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const filteredBusinesses = businesses

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
            onClick={() => { setFilterStatus(filter.value); setPage(1) }}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <Input
          placeholder="Search by business name or phone, then press Enter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
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
                  <p className={error ? 'text-red-600' : 'text-gray-500'}>{error || 'No subscriptions found'}</p>
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

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages || isLoading}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
