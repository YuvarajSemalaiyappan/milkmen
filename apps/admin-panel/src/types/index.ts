// Admin types
export interface AdminUser {
  id: string
  email: string
  name: string
}

// Business types
export interface Business {
  id: string
  name: string
  phone: string
  address?: string
  createdAt: string
  updatedAt: string
  subscription?: Subscription
  _count?: {
    users: number
    farmers: number
    customers: number
  }
}

// Subscription types
export type SubscriptionPlan = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL'
export type SubscriptionStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'

export interface Subscription {
  id: string
  businessId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPayment {
  id: string
  businessId: string
  businessName?: string
  businessPhone?: string
  plan: SubscriptionPlan
  amount: number
  paymentMethod?: string
  transactionId?: string
  notes?: string
  paidAt: string
  validFrom: string
  validUntil: string
  recordedBy: string
}

// Dashboard stats
export interface DashboardStats {
  totalBusinesses: number
  activeSubscriptions: number
  expiringSoon: number
  totalRevenue: number
  recentPayments: SubscriptionPayment[]
  businessesByPlan: Record<SubscriptionPlan, number>
}

// Toast types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

export interface DeletionRequest {
  id: string
  createdAt: string
  source: 'APP' | 'WEB_FORM'
  status: 'PENDING' | 'DONE' | 'REJECTED' | 'CANCELLED'
  userId: string | null
  businessId: string | null
  role: string | null
  name: string
  phone: string
  businessName: string | null
  reason: string | null
  handledAt: string | null
  adminNote: string | null
}
