import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AdminUser } from '@/types'

interface AuthState {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: AdminUser, token: string) => void
  updateUser: (user: Partial<AdminUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      updateUser: (changes) =>
        set((state) => (state.user ? { user: { ...state.user, ...changes } } : {})),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false })
    }),
    {
      name: 'admin-auth-storage'
    }
  )
)
