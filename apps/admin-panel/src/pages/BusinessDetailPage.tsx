import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Users, Milk, CreditCard, Calendar, KeyRound } from 'lucide-react'
import { Card, Button, Badge, SubscriptionBadge, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Input } from '@/components/ui'
import { useAppStore } from '@/store'
import { businessesApi, subscriptionsApi } from '@/services'
import type { Business, SubscriptionPayment, SubscriptionPlan } from '@/types'
import { format } from 'date-fns'

interface BusinessUser {
  id: string
  name: string
  phone: string
  role: string
  isActive: boolean
  createdAt: string
}

const PLAN_OPTIONS: { value: SubscriptionPlan; label: string; price: number }[] = [
  { value: 'MONTHLY', label: 'Monthly (30 days)', price: 299 },
  { value: 'QUARTERLY', label: 'Quarterly (90 days)', price: 799 },
  { value: 'HALF_YEARLY', label: 'Half Yearly (180 days)', price: 1499 },
  { value: 'ANNUAL', label: 'Annual (365 days)', price: 2499 }
]

export function BusinessDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addToast = useAppStore((state) => state.addToast)

  const [business, setBusiness] = useState<(Business & { users?: BusinessUser[] }) | null>(null)
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [isExtend, setIsExtend] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Activate/Extend form
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('MONTHLY')
  const [amount, setAmount] = useState(299)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [transactionId, setTransactionId] = useState('')

  useEffect(() => {
    loadBusiness()
  }, [id])

  const loadBusiness = async () => {
    if (!id) return
    try {
      const [businessRes, paymentsRes] = await Promise.all([
        businessesApi.get(id),
        businessesApi.getPayments(id)
      ])
      setBusiness(businessRes.data)
      setPayments(paymentsRes.data)
    } catch (error) {
      console.error('Failed to load business:', error)
      addToast({ type: 'error', message: 'Failed to load business details' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivateOrExtend = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      const data = {
        plan: selectedPlan,
        amount,
        paymentMethod: paymentMethod || undefined,
        transactionId: transactionId || undefined
      }

      if (isExtend) {
        await subscriptionsApi.extend(id, data)
        addToast({ type: 'success', message: 'Subscription extended!' })
      } else {
        await subscriptionsApi.activate(id, data)
        addToast({ type: 'success', message: 'Subscription activated!' })
      }

      setShowActivateModal(false)
      setPaymentMethod('')
      setTransactionId('')
      loadBusiness()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update subscription' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSuspend = async () => {
    if (!id || !confirm('Are you sure you want to suspend this subscription?')) return
    setActionLoading(true)
    try {
      await subscriptionsApi.suspend(id)
      addToast({ type: 'success', message: 'Subscription suspended' })
      loadBusiness()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to suspend subscription' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await subscriptionsApi.reactivate(id)
      addToast({ type: 'success', message: 'Subscription reactivated' })
      loadBusiness()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to reactivate subscription' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPin = async (userId: string, userName: string) => {
    if (!id || !confirm(`Reset PIN for ${userName} to 1234?`)) return
    try {
      const response = await businessesApi.resetPin(id, userId)
      addToast({ type: 'success', message: response.message || 'PIN reset successfully' })
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to reset PIN' })
    }
  }

  if (isLoading || !business) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/businesses')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          <p className="text-gray-500">{business.address || business.phone}</p>
        </div>
        <SubscriptionBadge status={business.subscription?.status || 'INACTIVE'} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Staff</p>
              <p className="text-2xl font-bold text-gray-900">{business._count?.users || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Milk className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Farmers</p>
              <p className="text-2xl font-bold text-gray-900">{business._count?.farmers || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Customers</p>
              <p className="text-2xl font-bold text-gray-900">{business._count?.customers || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-lg font-bold text-gray-900">
                {format(new Date(business.createdAt), 'MMM yyyy')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Subscription Details */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
          <div className="flex gap-2">
            {(!business.subscription || business.subscription.status === 'INACTIVE' || business.subscription.status === 'EXPIRED') && (
              <Button onClick={() => { setIsExtend(false); setShowActivateModal(true) }}>
                Activate Subscription
              </Button>
            )}
            {business.subscription?.status === 'ACTIVE' && (
              <>
                <Button variant="secondary" onClick={() => { setIsExtend(true); setShowActivateModal(true) }}>
                  Extend
                </Button>
                <Button variant="danger" size="sm" onClick={handleSuspend} isLoading={actionLoading}>
                  Suspend
                </Button>
              </>
            )}
            {business.subscription?.status === 'SUSPENDED' && (
              <Button onClick={handleReactivate} isLoading={actionLoading}>
                Reactivate
              </Button>
            )}
          </div>
        </div>

        {business.subscription ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-medium">{business.subscription.plan}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <SubscriptionBadge status={business.subscription.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="font-medium">
                {business.subscription.startDate
                  ? format(new Date(business.subscription.startDate), 'dd MMM yyyy')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End Date</p>
              <p className="font-medium">
                {business.subscription.endDate
                  ? format(new Date(business.subscription.endDate), 'dd MMM yyyy')
                  : '-'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No subscription</p>
        )}
      </Card>

      {/* Activate/Extend Modal */}
      {showActivateModal && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isExtend ? 'Extend Subscription' : 'Activate Subscription'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={selectedPlan}
                onChange={(e) => {
                  const plan = e.target.value as SubscriptionPlan
                  setSelectedPlan(plan)
                  const option = PLAN_OPTIONS.find(o => o.value === plan)
                  if (option) setAmount(option.price)
                }}
              >
                {PLAN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Amount"
              type="number"
              value={amount.toString()}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <Input
              label="Payment Method"
              placeholder="UPI, Cash, Bank Transfer..."
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <Input
              label="Transaction ID"
              placeholder="Reference number..."
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleActivateOrExtend} isLoading={actionLoading}>
              {isExtend ? 'Extend' : 'Activate'}
            </Button>
            <Button variant="secondary" onClick={() => setShowActivateModal(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Users/Staff */}
      {business.users && business.users.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Members</h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Phone</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {business.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'OWNER' ? 'warning' : user.role === 'MANAGER' ? 'info' : 'default'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'success' : 'default'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPin(user.id, user.name)}
                      leftIcon={<KeyRound className="w-4 h-4" />}
                    >
                      Reset PIN
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Plan</TableHeader>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Method</TableHeader>
              <TableHeader>Transaction ID</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No payments yet</p>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.paidAt), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="info">{payment.plan}</Badge>
                  </TableCell>
                  <TableCell>₹{payment.amount}</TableCell>
                  <TableCell>{payment.paymentMethod || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.transactionId || '-'}
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
