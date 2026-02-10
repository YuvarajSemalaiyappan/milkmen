// Enums
export type Role = 'OWNER' | 'MANAGER' | 'STAFF'
export type Shift = 'MORNING' | 'EVENING'
export type DeliveryStatus = 'DELIVERED' | 'SKIPPED' | 'CANCELLED'
export type PaymentType = 'PAID_TO_FARMER' | 'RECEIVED_FROM_CUSTOMER' | 'ADVANCE_TO_FARMER' | 'ADVANCE_FROM_CUSTOMER'
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER'
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'
export type SubscriptionPlan = 'FREE' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL'

export interface SubscriptionInfo {
  plan: SubscriptionPlan
  status: 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  active: boolean
  endDate: string | null
  daysRemaining: number
}

// Base entity with sync support
export interface SyncableEntity {
  id: string
  localId: string
  syncStatus: SyncStatus
  createdAt: number
  updatedAt: number
}

// Business
export interface Business {
  id: string
  name: string
  phone: string
  address?: string
  createdAt: string
  updatedAt: string
}

// User
export interface User {
  id: string
  businessId: string
  name: string
  phone: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Farmer
export interface Farmer {
  id: string
  businessId: string
  name: string
  phone?: string
  village?: string
  defaultRate: number
  collectAM?: boolean
  collectPM?: boolean
  isActive: boolean
  balance: number
  createdAt: string
  updatedAt: string
}

export interface LocalFarmer extends SyncableEntity {
  data: {
    name: string
    phone?: string
    village?: string
    defaultRate: number
    collectAM?: boolean
    collectPM?: boolean
    isActive: boolean
    balance: number
  }
}

// Customer
export interface Customer {
  id: string
  businessId: string
  name: string
  phone?: string
  address?: string
  defaultRate: number
  subscriptionQtyAM?: number
  subscriptionQtyPM?: number
  isActive: boolean
  balance: number
  createdAt: string
  updatedAt: string
}

export interface LocalCustomer extends SyncableEntity {
  data: {
    name: string
    phone?: string
    address?: string
    defaultRate: number
    subscriptionQtyAM?: number
    subscriptionQtyPM?: number
    isActive: boolean
    balance: number
  }
}

// Collection (Purchase from Farmer)
export interface Collection {
  id: string
  businessId: string
  farmerId: string
  collectedBy: string
  date: string
  shift: Shift
  quantity: number
  fatContent?: number
  ratePerLiter: number
  totalAmount: number
  rateEditedAt?: string
  rateEditedBy?: string
  originalRate?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface LocalCollection extends SyncableEntity {
  data: {
    farmerId: string
    date: string
    shift: Shift
    quantity: number
    fatContent?: number
    ratePerLiter: number
    totalAmount: number
    rateEditedAt?: string
    originalRate?: number
    notes?: string
  }
}

// Delivery (Sale to Customer)
export interface Delivery {
  id: string
  businessId: string
  customerId: string
  deliveredBy: string
  date: string
  shift: Shift
  quantity: number
  ratePerLiter: number
  totalAmount: number
  rateEditedAt?: string
  originalRate?: number
  isSubscription: boolean
  status: DeliveryStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface LocalDelivery extends SyncableEntity {
  data: {
    customerId: string
    date: string
    shift: Shift
    quantity: number
    ratePerLiter: number
    totalAmount: number
    rateEditedAt?: string
    originalRate?: number
    isSubscription: boolean
    status: DeliveryStatus
    notes?: string
  }
}

// Payment
export interface Payment {
  id: string
  businessId: string
  farmerId?: string
  customerId?: string
  recordedBy: string
  date: string
  amount: number
  type: PaymentType
  method: PaymentMethod
  notes?: string
  createdAt: string
}

export interface LocalPayment extends SyncableEntity {
  data: {
    farmerId?: string
    customerId?: string
    date: string
    amount: number
    type: PaymentType
    method: PaymentMethod
    notes?: string
  }
}

// Rate
export interface Rate {
  id: string
  businessId: string
  farmerId?: string
  fatFrom: number
  fatTo: number
  ratePerLiter: number
  effectiveFrom: string
  effectiveTo?: string
  createdAt: string
}

export interface LocalRate extends SyncableEntity {
  data: {
    farmerId?: string
    fatFrom: number
    fatTo: number
    ratePerLiter: number
    effectiveFrom: string
    effectiveTo?: string
  }
}

// Route
export interface Route {
  id: string
  businessId: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RouteWithCounts extends Route {
  _count: {
    userRoutes: number
    routeFarmers: number
    routeCustomers: number
  }
}

export interface UserRoute {
  id: string
  userId: string
  routeId: string
}

export interface RouteFarmer {
  id: string
  routeId: string
  farmerId: string
  areaId?: string
  sortOrder: number
}

export interface RouteCustomer {
  id: string
  routeId: string
  customerId: string
  areaId?: string
  sortOrder: number
}

// Area
export interface Area {
  id: string
  routeId: string
  businessId: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AreaWithCounts extends Area {
  _count: {
    routeFarmers: number
    routeCustomers: number
  }
}

// User sort orders
export interface UserFarmerOrder {
  id: string
  odlocalId: string
  userId: string
  farmerId: string
  sortOrder: number
}

export interface UserCustomerOrder {
  id: string
  localId: string
  userId: string
  customerId: string
  shift?: Shift
  sortOrder: number
}

// Sync Queue Item
export interface SyncQueueItem {
  id?: number
  table: string
  localId: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  status: 'pending' | 'processing' | 'failed'
  retryCount: number
  createdAt: number
}

// Auth types
export interface AuthUser {
  id: string
  businessId: string
  name: string
  phone: string
  role: Role
}

export interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Report types
export interface DailySummary {
  date: string
  totalCollectionLiters: number
  totalCollectionAmount: number
  totalSalesLiters: number
  totalSalesAmount: number
  totalPaymentsToFarmers: number
  totalPaymentsFromCustomers: number
  profit: number
}

export interface FarmerDue {
  farmer: Farmer
  totalLiters: number
  totalAmount: number
  totalPaid: number
  balance: number
  collections: Collection[]
}

export interface CustomerDue {
  customer: Customer
  totalLiters: number
  totalAmount: number
  totalPaid: number
  balance: number
  deliveries: Delivery[]
}
