import { useAuthStore } from '@/store'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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
          throw new Error(`API Error: ${retryResponse.status}`)
        }
        return retryResponse.json()
      } else {
        // Refresh failed, logout
        useAuthStore.getState().logout()
        throw new Error('Session expired')
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API Error: ${response.status}`)
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
  create: (data: { name: string; phone?: string; village?: string; defaultRate: number }) =>
    api.post('/farmers', data),
  update: (id: string, data: Partial<{ name: string; phone?: string; village?: string; defaultRate: number; isActive: boolean }>) =>
    api.put(`/farmers/${id}`, data),
  delete: (id: string) => api.delete(`/farmers/${id}`),
  updateSortOrder: (orders: { farmerId: string; sortOrder: number }[]) =>
    api.put('/farmers/sort-order', { orders })
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
    subscriptionQty?: number
    subscriptionAM?: boolean
    subscriptionPM?: boolean
  }) => api.post('/customers', data),
  update: (id: string, data: Partial<{
    name: string
    phone?: string
    address?: string
    defaultRate: number
    subscriptionQty?: number
    subscriptionAM?: boolean
    subscriptionPM?: boolean
    isActive: boolean
  }>) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  updateSortOrder: (orders: { customerId: string; shift?: string; sortOrder: number }[]) =>
    api.put('/customers/sort-order', { orders })
}

// Collections API
export const collectionsApi = {
  list: (params?: { date?: string; farmerId?: string }) =>
    api.get(`/collections${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
  get: (id: string) => api.get(`/collections/${id}`),
  create: (data: {
    farmerId: string
    date: string
    shift: string
    quantity: number
    fatContent?: number
    ratePerLiter: number
    notes?: string
    localId?: string
  }) => api.post('/collections', data),
  update: (id: string, data: Partial<{
    quantity: number
    fatContent?: number
    ratePerLiter: number
    notes?: string
  }>) => api.put(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
  bulkSync: (collections: unknown[]) => api.post('/collections/bulk', { collections })
}

// Deliveries API
export const deliveriesApi = {
  list: (params?: { date?: string; customerId?: string }) =>
    api.get(`/deliveries${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
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
    localId?: string
  }) => api.post('/deliveries', data),
  update: (id: string, data: Partial<{
    quantity: number
    ratePerLiter: number
    status: string
    notes?: string
  }>) => api.put(`/deliveries/${id}`, data),
  delete: (id: string) => api.delete(`/deliveries/${id}`),
  bulkUpdate: (deliveries: { id: string; status: string }[]) =>
    api.post('/deliveries/bulk', { deliveries })
}

// Payments API
export const paymentsApi = {
  list: (params?: { date?: string; farmerId?: string; customerId?: string }) =>
    api.get(`/payments${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
  get: (id: string) => api.get(`/payments/${id}`),
  create: (data: {
    farmerId?: string
    customerId?: string
    date: string
    amount: number
    type: string
    method: string
    notes?: string
    localId?: string
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
  farmerDues: (from: string, to: string) =>
    api.get(`/reports/farmer-dues?from=${from}&to=${to}`),
  customerDues: (from: string, to: string) =>
    api.get(`/reports/customer-dues?from=${from}&to=${to}`),
  collections: (from: string, to: string, farmerId?: string) =>
    api.get(`/reports/collections?from=${from}&to=${to}${farmerId ? `&farmerId=${farmerId}` : ''}`),
  deliveries: (from: string, to: string, customerId?: string) =>
    api.get(`/reports/deliveries?from=${from}&to=${to}${customerId ? `&customerId=${customerId}` : ''}`),
  profit: (from: string, to: string) =>
    api.get(`/reports/profit?from=${from}&to=${to}`)
}

// Areas API
export const areasApi = {
  list: (routeId: string) => api.get(`/areas?routeId=${routeId}`),
  create: (data: { routeId: string; name: string; description?: string }) =>
    api.post('/areas', data),
  update: (id: string, data: Partial<{ name: string; description?: string; sortOrder: number; isActive: boolean }>) =>
    api.put(`/areas/${id}`, data),
  delete: (id: string) => api.delete(`/areas/${id}`)
}

// Routes API
export const routesApi = {
  list: (params?: { active?: string }) =>
    api.get(`/routes${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
  get: (id: string) => api.get(`/routes/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/routes', data),
  update: (id: string, data: Partial<{ name: string; description?: string; isActive: boolean }>) =>
    api.put(`/routes/${id}`, data),
  delete: (id: string) => api.delete(`/routes/${id}`),
  assignUsers: (routeId: string, userIds: string[]) =>
    api.post(`/routes/${routeId}/users`, { userIds }),
  removeUser: (routeId: string, userId: string) =>
    api.delete(`/routes/${routeId}/users/${userId}`),
  assignFarmers: (routeId: string, farmerIds: string[], sortOrders?: Record<string, number>, areaId?: string) =>
    api.post(`/routes/${routeId}/farmers`, { farmerIds, sortOrders, areaId }),
  removeFarmer: (routeId: string, farmerId: string) =>
    api.delete(`/routes/${routeId}/farmers/${farmerId}`),
  assignCustomers: (routeId: string, customerIds: string[], sortOrders?: Record<string, number>, areaId?: string) =>
    api.post(`/routes/${routeId}/customers`, { customerIds, sortOrders, areaId }),
  removeCustomer: (routeId: string, customerId: string) =>
    api.delete(`/routes/${routeId}/customers/${customerId}`),
  getCustomerIds: (routeId: string, areaId?: string) =>
    api.get(`/routes/${routeId}/customer-ids${areaId ? `?areaId=${areaId}` : ''}`),
  getFarmerIds: (routeId: string, areaId?: string) =>
    api.get(`/routes/${routeId}/farmer-ids${areaId ? `?areaId=${areaId}` : ''}`)
}

// Subscription API
export const subscriptionApi = {
  get: () => api.get('/settings/subscription')
}

// Sync API
export const syncApi = {
  push: (data: unknown) => api.post('/sync/push', data),
  pull: (since: number) => api.get(`/sync/pull?since=${since}`)
}

export default api
