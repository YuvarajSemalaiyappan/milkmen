import { useAuthStore } from '@/store'
import i18n from '@/i18n'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Carries the server's error code (for example DUPLICATE_ENTRY) as well as its message
export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({ error: 'Unknown error' }))
  // 402 PLAN_EXPIRED / PLAN_SUSPENDED / PLAN_INACTIVE: the server refused a save because the plan
  // isn't active. Show it in the user's language and mark the stored plan inactive so the
  // dashboard shows it too.
  if (typeof body.code === 'string' && body.code.startsWith('PLAN_')) {
    const key = body.code.slice(5).toLowerCase() as 'expired' | 'suspended' | 'inactive'
    const auth = useAuthStore.getState()
    if (auth.subscription) {
      auth.setSubscription({
        ...auth.subscription,
        active: false,
        status: key.toUpperCase() as 'EXPIRED' | 'SUSPENDED' | 'INACTIVE'
      })
    }
    return new ApiError(i18n.t(`plan.${key}`), response.status, body.code)
  }
  return new ApiError(body.error || `API Error: ${response.status}`, response.status, body.code)
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options
    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers
    }

    // Add auth token if available and not skipped
    if (!skipAuth) {
      const token = useAuthStore.getState().token
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers
    })

    // Handle 401 - try to refresh token
    if (response.status === 401 && !skipAuth) {
      const refreshed = await this.refreshToken()
      if (refreshed) {
        // Retry the request with new token
        const newToken = useAuthStore.getState().token
        if (newToken) {
          (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`
        }
        const retryResponse = await fetch(url, { ...fetchOptions, headers })
        if (!retryResponse.ok) {
          throw await toApiError(retryResponse)
        }
        return retryResponse.json()
      } else {
        // Refresh failed, logout and redirect to login
        useAuthStore.getState().logout()
        window.location.href = '/login'
        throw new Error('Session expired')
      }
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    return response.json()
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) return false

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) return false

      const data = await response.json()
      if (data.success && data.data) {
        useAuthStore.getState().setToken(data.data.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // GET request
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  // POST request
  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  // PUT request
  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  // DELETE request
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const api = new ApiService(API_BASE_URL)

// Auth API
export const authApi = {
  login: (phone: string, pin: string) =>
    api.post('/auth/login', { phone, pin }, { skipAuth: true }),

  register: (data: {
    businessName: string
    ownerName: string
    phone: string
    pin: string
    address?: string
  }) => api.post('/auth/register', data, { skipAuth: true }),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }, { skipAuth: true }),

  changePin: (userId: string, currentPin: string, newPin: string) =>
    api.post('/auth/change-pin', { userId, currentPin, newPin })
}

// Farmers API
export const farmersApi = {
  list: () => api.get('/farmers'),
  get: (id: string) => api.get(`/farmers/${id}`),
  create: (data: { name: string; phone?: string; village?: string; defaultRate: number; collectAM?: boolean; collectPM?: boolean; subscriptionQtyAM?: number; subscriptionQtyPM?: number }) =>
    api.post('/farmers', data),
  update: (id: string, data: Partial<{ name: string; phone?: string; village?: string; defaultRate: number; collectAM: boolean; collectPM: boolean; subscriptionQtyAM?: number; subscriptionQtyPM?: number; isActive: boolean }>) =>
    api.put(`/farmers/${id}`, data),
  delete: (id: string) => api.delete(`/farmers/${id}`),
  updateSortOrder: (orders: { farmerId: string; shift?: string; sortOrder: number }[]) =>
    api.put('/farmers/sort-order', { orders }),
  getSortOrder: (shift?: string) =>
    api.get(`/farmers/sort-order${shift ? `?shift=${shift}` : ''}`)
}

// Customers API
export const customersApi = {
  list: () => api.get('/customers'),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: {
    name: string
    phone?: string
    address?: string
    defaultRate: number
    subscriptionQtyAM?: number
    subscriptionQtyPM?: number
  }) => api.post('/customers', data),
  update: (id: string, data: Partial<{
    name: string
    phone?: string
    address?: string
    defaultRate: number
    subscriptionQtyAM?: number
    subscriptionQtyPM?: number
    isActive: boolean
  }>) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  updateSortOrder: (orders: { customerId: string; shift?: string; sortOrder: number }[]) =>
    api.put('/customers/sort-order', { orders }),
  getSortOrder: (shift?: string) =>
    api.get(`/customers/sort-order${shift ? `?shift=${shift}` : ''}`)
}

// Helper to build query string from optional params
function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  return filtered.length ? `?${new URLSearchParams(filtered)}` : ''
}

// Collections API
export const collectionsApi = {
  // paid: '1' adds isPaid to each row (the server decides)
  list: (params?: { date?: string; farmerId?: string; from?: string; to?: string; paid?: '1' }) =>
    api.get(`/collections${buildQuery(params)}`),
  get: (id: string) => api.get(`/collections/${id}`),
  create: (data: {
    farmerId: string
    date: string
    shift: string
    quantity: number
    fatContent?: number
    ratePerLiter: number
    notes?: string
    allowDuplicate?: boolean
  }) => api.post('/collections', data),
  update: (id: string, data: Partial<{
    quantity: number
    fatContent?: number
    ratePerLiter: number
    notes?: string
    // Move to another day/shift (409 DUPLICATE_ENTRY → resend with allowDuplicate; 409 PAID_PERIOD → blocked)
    date?: string
    shift?: string
    allowDuplicate?: boolean
  }>) => api.put(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`)
}

// Deliveries API
export const deliveriesApi = {
  // paid: '1' adds isPaid to each row (the server decides)
  list: (params?: { date?: string; customerId?: string; from?: string; to?: string; shift?: string; status?: string; limit?: string; paid?: '1' }) =>
    api.get(`/deliveries${buildQuery(params)}`),
  get: (id: string) => api.get(`/deliveries/${id}`),
  today: (shift?: string) =>
    api.get(`/deliveries/today${shift ? `?shift=${shift}` : ''}`),
  create: (data: {
    customerId: string
    date: string
    shift: string
    quantity: number
    ratePerLiter: number
    isSubscription?: boolean
    status?: string
    notes?: string
    allowDuplicate?: boolean
  }) => api.post('/deliveries', data),
  update: (id: string, data: Partial<{
    quantity: number
    ratePerLiter: number
    status: string
    notes?: string
    // Move to another day/shift (409 DUPLICATE_ENTRY → resend with allowDuplicate; 409 PAID_PERIOD → blocked)
    date?: string
    shift?: string
    allowDuplicate?: boolean
  }>) => api.put(`/deliveries/${id}`, data),
  delete: (id: string) => api.delete(`/deliveries/${id}`),
  bulkUpdate: (deliveries: { id: string; status: string }[]) =>
    api.post('/deliveries/bulk-update', { deliveries })
}

// Payments API
export const paymentsApi = {
  list: (params?: { date?: string; farmerId?: string; customerId?: string; from?: string; to?: string; type?: string }) =>
    api.get(`/payments${buildQuery(params)}`),
  get: (id: string) => api.get(`/payments/${id}`),
  // Default period start, unpaid total over all entries and payments, and overlap (server-side)
  period: (params: { farmerId?: string; customerId?: string; from?: string; fromShift?: string; to: string; toShift: string }) =>
    api.get(`/payments/period${buildQuery(params)}`),
  // Unpaid entries over the whole history, balance, advance and pending for one person
  summary: (params: { farmerId?: string; customerId?: string }) =>
    api.get(`/payments/summary${buildQuery(params)}`),
  // One month of paid / unpaid days for the calendar on the farmer and customer pages
  calendar: (params: { farmerId?: string; customerId?: string; month: string }) =>
    api.get(`/payments/calendar${buildQuery(params)}`),
  create: (data: {
    farmerId?: string
    customerId?: string
    date: string
    amount: number
    type: string
    method: string
    notes?: string
  }) => api.post('/payments', data),
  update: (id: string, data: Partial<{
    amount: number
    method: string
    notes?: string
  }>) => api.put(`/payments/${id}`, data),
  delete: (id: string) => api.delete(`/payments/${id}`)
}

// Reports API
export const reportsApi = {
  daily: (date: string) => api.get(`/reports/daily?date=${date}`),
  // Month figures (from/to) plus running balance; optional route/area filter
  farmerDues: (from: string, to: string, routeId?: string | null, areaId?: string | null) =>
    api.get(`/reports/farmer-dues${buildQuery({ from, to, routeId: routeId ?? undefined, areaId: areaId ?? undefined })}`),
  customerDues: (from: string, to: string, routeId?: string | null, areaId?: string | null) =>
    api.get(`/reports/customer-dues${buildQuery({ from, to, routeId: routeId ?? undefined, areaId: areaId ?? undefined })}`),
  // Customers who owed money at the end of the month and paid nothing in it, largest first
  customerUnpaid: (month: string, routeId?: string | null, areaId?: string | null) =>
    api.get(`/reports/customer-unpaid${buildQuery({ month, routeId: routeId ?? undefined, areaId: areaId ?? undefined })}`),
  // One customer's dues split by month, most recent first (adds up to the balance)
  customerPending: (id: string) => api.get(`/reports/customer-pending/${id}`),
  collections: (from: string, to: string, farmerId?: string) =>
    api.get(`/reports/collections?from=${from}&to=${to}&paid=1${farmerId ? `&farmerId=${farmerId}` : ''}`),
  // summaryOnly: totals and groupings without the entry rows (rows=0)
  deliveries: (from: string, to: string, customerId?: string, summaryOnly = false) =>
    api.get(`/reports/deliveries?from=${from}&to=${to}${customerId ? `&customerId=${customerId}` : ''}${summaryOnly ? '&rows=0' : ''}`),
  profitLoss: (from: string, to: string) =>
    api.get(`/reports/profit-loss?from=${from}&to=${to}`)
}

// Areas API
export const areasApi = {
  list: (routeId: string) =>
    api.get(`/areas?routeId=${routeId}`),
  create: (data: { routeId: string; name: string }) =>
    api.post('/areas', data),
  update: (id: string, data: Partial<{ name: string; isActive: boolean }>) =>
    api.put(`/areas/${id}`, data),
  delete: (id: string) => api.delete(`/areas/${id}`)
}

// Routes API
export const routesApi = {
  list: (params?: { active?: string }) =>
    api.get(`/routes${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
  get: (id: string) => api.get(`/routes/${id}`),
  // Ids and areas only, for screens that just filter by route
  getScope: (id: string) => api.get(`/routes/${id}?scope=1`),
  create: (data: { name: string; description?: string }) =>
    api.post('/routes', data),
  update: (id: string, data: Partial<{ name: string; description?: string; isActive: boolean }>) =>
    api.put(`/routes/${id}`, data),
  delete: (id: string) => api.delete(`/routes/${id}`),
  assignUsers: (routeId: string, userIds: string[]) =>
    api.post(`/routes/${routeId}/users`, { userIds }),
  removeUser: (routeId: string, userId: string) =>
    api.delete(`/routes/${routeId}/users/${userId}`),
  assignFarmers: (routeId: string, farmerIds: string[], sortOrders?: Record<string, number>, areaIds?: Record<string, string>) =>
    api.post(`/routes/${routeId}/farmers`, { farmerIds, sortOrders, areaIds }),
  removeFarmer: (routeId: string, farmerId: string) =>
    api.delete(`/routes/${routeId}/farmers/${farmerId}`),
  assignCustomers: (routeId: string, customerIds: string[], sortOrders?: Record<string, number>, areaIds?: Record<string, string>) =>
    api.post(`/routes/${routeId}/customers`, { customerIds, sortOrders, areaIds }),
  removeCustomer: (routeId: string, customerId: string) =>
    api.delete(`/routes/${routeId}/customers/${customerId}`)
}

// Subscription API
export const subscriptionApi = {
  get: () => api.get('/settings/subscription')
}

export default api

// Account deletion requests. Nothing is deleted at once: the admin handles each request.
export interface DeletionRequestInfo {
  id: string
  createdAt: string
  status: string
}

export const accountApi = {
  getDeletionRequest: () =>
    api.get<{ success: boolean; data: DeletionRequestInfo | null }>('/account/deletion-request'),
  requestDeletion: (reason?: string) =>
    api.post<{ success: boolean; data: DeletionRequestInfo }>('/account/deletion-request', { reason }),
  withdrawDeletion: () => api.delete('/account/deletion-request'),
  // The public /delete-account page (no sign-in)
  requestDeletionPublic: (data: { name: string; phone: string; businessName?: string; reason?: string }) =>
    api.post<{ success: boolean; data: DeletionRequestInfo }>('/account/deletion-request/public', data, { skipAuth: true })
}

// Sharing the collect/deliver order (both shifts): follow someone's order (live, read-only),
// stop following (keeps a copy), or copy once. userId: the owner changing it for a staff member.
export const orderShareApi = {
  get: (kind: 'farmer' | 'customer', userId?: string) =>
    api.get(`/${kind}s/sort-order/follow${userId ? `?userId=${userId}` : ''}`),
  follow: (kind: 'farmer' | 'customer', followUserId: string | null, userId?: string) =>
    api.put(`/${kind}s/sort-order/follow`, { followUserId, userId }),
  copy: (kind: 'farmer' | 'customer', fromUserId: string, userId?: string) =>
    api.post(`/${kind}s/sort-order/copy`, { fromUserId, userId })
}
