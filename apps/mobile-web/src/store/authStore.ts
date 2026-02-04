import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser, Role } from '@/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setUser: (user: AuthUser, token: string, refreshToken: string) => void
  updateUser: (user: Partial<AuthUser>) => void
  setToken: (token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user, token, refreshToken) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false
        })
      },

      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null
        }))
      },

      setToken: (token) => {
        set({ token })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false
        })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      }
    }),
    {
      name: 'milkmen_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

// Helper selectors
export const selectIsOwner = (state: AuthState): boolean =>
  state.user?.role === 'OWNER'

export const selectIsManager = (state: AuthState): boolean =>
  state.user?.role === 'MANAGER' || state.user?.role === 'OWNER'

export const selectCanManageStaff = (state: AuthState): boolean =>
  state.user?.role === 'OWNER'

export const selectCanEditRates = (state: AuthState): boolean =>
  state.user?.role === 'OWNER' || state.user?.role === 'MANAGER'

export const selectUserRole = (state: AuthState): Role | null =>
  state.user?.role || null
