import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Building2 } from 'lucide-react'
import { Card, Input, Button, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SubscriptionBadge } from '@/components/ui'
import { businessesApi } from '@/services'
import type { Business } from '@/types'

export function BusinessesPage() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    try {
      const response = await businessesApi.list({ search: search || undefined })
      setBusinesses(response.data)
    } catch (err) {
      console.error('Failed to load businesses:', err)
      setError('Failed to load businesses')
    } finally {
      setIsLoading(false)
    }
  }

  // Re-fetch when search changes (debounced via user pressing enter or clearing)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsLoading(true)
      loadBusinesses()
    }
  }

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search)
  )

  if (isLoading) {
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
          <Button onClick={() => { setError(''); setIsLoading(true); loadBusinesses() }}>
            Retry
          </Button>
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
          placeholder="Search by name or phone..."
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
            {filteredBusinesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No businesses found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredBusinesses.map((business) => (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/businesses/${business.id}`)}
                      leftIcon={<Eye className="w-4 h-4" />}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
