import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { AdminLayout } from '@/components/layout'
import {
  LoginPage,
  DashboardPage,
  BusinessesPage,
  BusinessDetailPage,
  SubscriptionsPage,
  SettingsPage
} from '@/pages'

// Protected route wrapper
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// Public route wrapper (redirect to home if authenticated)
function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />
      }
    ]
  },

  // Protected routes with admin layout
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: '/',
            element: <DashboardPage />
          },
          {
            path: '/businesses',
            element: <BusinessesPage />
          },
          {
            path: '/businesses/:id',
            element: <BusinessDetailPage />
          },
          {
            path: '/subscriptions',
            element: <SubscriptionsPage />
          },
          {
            path: '/settings',
            element: <SettingsPage />
          }
        ]
      }
    ]
  },

  // Catch all - redirect to home
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])
