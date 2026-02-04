import { useState, useEffect } from 'react'
import { Building2, CreditCard, AlertTriangle, IndianRupee } from 'lucide-react'
import { StatCard, Card, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SubscriptionBadge } from '@/components/ui'
import { dashboardApi } from '@/services'
import type { DashboardStats } from '@/types'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await dashboardApi.getStats()
      setStats(response.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
      setError('Failed to load dashboard stats')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your business metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Businesses"
          value={stats?.totalBusinesses || 0}
          icon={<Building2 className="w-6 h-6" />}
        />
        <StatCard
          title="Active Subscriptions"
          value={stats?.activeSubscriptions || 0}
          icon={<CreditCard className="w-6 h-6" />}
        />
        <StatCard
          title="Expiring Soon"
          value={stats?.expiringSoon || 0}
          subtitle="Next 7 days"
          icon={<AlertTriangle className="w-6 h-6" />}
        />
        <StatCard
          title="Total Revenue"
          value={`₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`}
          icon={<IndianRupee className="w-6 h-6" />}
        />
      </div>

      {/* Subscription Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Subscriptions by Plan
          </h3>
          <div className="space-y-4">
            {Object.entries(stats?.businessesByPlan || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{plan.replace('_', ' ')}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(count / (stats?.totalBusinesses || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Payments
          </h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Business</TableHeader>
                <TableHeader>Plan</TableHeader>
                <TableHeader>Amount</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats?.recentPayments && stats.recentPayments.length > 0 ? (
                stats.recentPayments.slice(0, 5).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.businessName || payment.businessId}</TableCell>
                    <TableCell>
                      <SubscriptionBadge status={payment.plan} />
                    </TableCell>
                    <TableCell>₹{payment.amount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-center text-gray-500" colSpan={3}>
                    No recent payments
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
