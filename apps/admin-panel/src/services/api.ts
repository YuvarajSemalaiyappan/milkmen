import { useAuthStore } from '@/store'

const API_BASE = '/api/admin'

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  })

  if (response.status === 401) {
    useAuthStore.getState().logout()
    window.location.href = '/admin/login'
    throw new Error('Unauthorized')
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },

  me: async () => {
    return fetchWithAuth('/auth/me')
  },

  updateProfile: async (data: { name: string; email: string }) => {
    return fetchWithAuth('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return fetchWithAuth('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    })
  }
}

// Dashboard API
export const dashboardApi = {
  getStats: async () => {
    return fetchWithAuth('/dashboard/stats')
  }
}

// Businesses API
export const businessesApi = {
  list: async (params?: { search?: string; status?: string; page?: number }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', params.page.toString())
    return fetchWithAuth(`/businesses?${query}`)
  },

  get: async (id: string) => {
    return fetchWithAuth(`/businesses/${id}`)
  },

  getSubscription: async (id: string) => {
    return fetchWithAuth(`/businesses/${id}/subscription`)
  },

  getPayments: async (id: string) => {
    return fetchWithAuth(`/businesses/${id}/payments`)
  },

  resetPin: async (businessId: string, userId: string) => {
    return fetchWithAuth(`/businesses/${businessId}/reset-pin/${userId}`, {
      method: 'POST'
    })
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/businesses/${id}`, { method: 'DELETE' })
  }
}

// Subscriptions API
export const subscriptionsApi = {
  activate: async (businessId: string, data: {
    plan: string
    amount: number
    paymentMethod?: string
    transactionId?: string
    notes?: string
  }) => {
    return fetchWithAuth(`/subscriptions/${businessId}/activate`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  extend: async (businessId: string, data: {
    plan: string
    amount: number
    paymentMethod?: string
    transactionId?: string
    notes?: string
  }) => {
    return fetchWithAuth(`/subscriptions/${businessId}/extend`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  suspend: async (businessId: string, reason?: string) => {
    return fetchWithAuth(`/subscriptions/${businessId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  },

  reactivate: async (businessId: string) => {
    return fetchWithAuth(`/subscriptions/${businessId}/reactivate`, {
      method: 'POST'
    })
  },

  getPricing: async (): Promise<{ data: { plan: string; amount: number }[] }> => {
    return fetchWithAuth('/subscriptions/pricing')
  },

  updatePricing: async (prices: { plan: string; amount: number }[]) => {
    return fetchWithAuth('/subscriptions/pricing', {
      method: 'PUT',
      body: JSON.stringify({ prices })
    })
  }
}

export { fetchWithAuth }

// Account deletion requests (from the apps and the public /delete-account page)
export const deletionRequestsApi = {
  list: async (status?: string) => {
    const query = status ? `?status=${status}` : ''
    return fetchWithAuth(`/deletion-requests${query}`)
  },

  update: async (id: string, data: { status: 'PENDING' | 'DONE' | 'REJECTED'; adminNote?: string }) => {
    return fetchWithAuth(`/deletion-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }
}
