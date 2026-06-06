import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Building2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, Input, Button, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SubscriptionBadge } from '@/components/ui'
import { businessesApi } from '@/services'
import { useAppStore } from '@/store'
import type { Business } from '@/types'

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function BusinessesPage() {
  const navigate = useNavigate()
  const addToast = useAppStore((state) => state.addToast)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await businessesApi.list({
        search: appliedSearch || undefined,
        page
      })
      setBusinesses(response.data)
      setPagination(response.pagination)
      setError('')
    } catch (err) {
      console.error('Failed to load businesses:', err)
      setError('Failed to load businesses')
    } finally {
      setIsLoading(false)
    }
  }, [appliedSearch, page])

  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1)
      setAppliedSearch(search)
    }
  }

  const handleDelete = async (business: Business) => {
    const confirmed = window.confirm(
      `Delete "${business.name}" (${business.phone}) and all its data?\n\nThis removes users, farmers, customers, collections, deliveries, payments, routes, and subscription. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(business.id)
    try {
      await businessesApi.delete(business.id)
      addToast({ type: 'success', message: `Deleted ${business.name}` })
      const isLastItemOnPage = businesses.length === 1 && page > 1
      if (isLastItemOnPage) {
        setPage(page - 1)
      } else {
        loadBusinesses()
      }
    } catch (err) {
      console.error('Delete failed:', err)
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' })
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading && businesses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error && businesses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadBusinesses}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="text-gray-500 mt-1">Manage registered businesses</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <Input
          placeholder="Search by name or phone, then press Enter..."
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
              <TableHeader>Phone</TableHeader>
              <TableHeader>Farmers</TableHeader>
              <TableHeader>Customers</TableHeader>
              <TableHeader>Subscription</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No businesses found</p>
                </TableCell>
              </TableRow>
            ) : (
              businesses.map((business) => (
                <TableRow key={business.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{business.name}</p>
                      <p className="text-xs text-gray-500">{business.address}</p>
                    </div>
                  </TableCell>
                  <TableCell>{business.phone}</TableCell>
                  <TableCell>{business._count?.farmers || 0}</TableCell>
                  <TableCell>{business._count?.customers || 0}</TableCell>
                  <TableCell>
                    <SubscriptionBadge status={business.subscription?.status || 'INACTIVE'} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/businesses/${business.id}`)}
                        leftIcon={<Eye className="w-4 h-4" />}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(business)}
                        disabled={deletingId === business.id}
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        className="text-red-600 hover:bg-red-50"
                      >
                        {deletingId === business.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {pagination.totalPages > 0 && (
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
