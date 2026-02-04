import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { syncService } from '@/services/syncService'

// Feature pages
import { DashboardPage } from '@/features/dashboard'
import { FarmersPage, AddFarmerPage, FarmerDetailPage } from '@/features/farmers'
import { CustomersPage, AddCustomerPage, CustomerDetailPage } from '@/features/customers'
import { CollectionsPage, AddCollectionPage, CollectionDetailPage } from '@/features/collections'
import { DeliveriesPage, AddDeliveryPage, TodayDeliveriesPage, DeliveryDetailPage } from '@/features/deliveries'
import { PaymentsPage, AddPaymentPage } from '@/features/payments'
import {
  ReportsPage,
  DailyReportPage,
  FarmerDuesReportPage,
  CustomerDuesReportPage,
  CollectionsReportPage,
  DeliveriesReportPage,
  ProfitLossReportPage
} from '@/features/reports'
import {
  SettingsPage,
  ProfilePage,
  BusinessSettingsPage,
  StaffManagementPage,
  RateSettingsPage,
  SyncSettingsPage,
  AboutPage
} from '@/features/settings'
import {
  RoutesPage,
  AddRoutePage,
  RouteDetailPage,
  RouteAssignUsersPage,
  RouteAssignFarmersPage,
  RouteAssignCustomersPage
} from '@/features/routes'
import { MorePage } from '@/features/more'
import { LoginPage, RegisterPage } from '@/features/auth'

// Protected route wrapper
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    // Pull on initial load
    syncService.sync().catch((err) => {
      console.error('Auto-sync on app load failed:', err)
    })

    // Pull when tab/window regains focus (to get changes from other devices)
    const onFocus = () => {
      syncService.sync().catch((err) => {
        console.error('Auto-sync on focus failed:', err)
      })
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [isAuthenticated])

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
      },
      {
        path: '/register',
        element: <RegisterPage />
      }
    ]
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardPage />
      },
      {
        path: '/collect',
        element: <CollectionsPage />
      },
      {
        path: '/collect/add',
        element: <AddCollectionPage />
      },
      {
        path: '/collect/:id',
        element: <CollectionDetailPage />
      },
      {
        path: '/deliver',
        element: <DeliveriesPage />
      },
      {
        path: '/deliver/add',
        element: <AddDeliveryPage />
      },
      {
        path: '/deliver/:id',
        element: <DeliveryDetailPage />
      },
      {
        path: '/farmers',
        element: <FarmersPage />
      },
      {
        path: '/farmers/add',
        element: <AddFarmerPage />
      },
      {
        path: '/farmers/:id',
        element: <FarmerDetailPage />
      },
      {
        path: '/customers',
        element: <CustomersPage />
      },
      {
        path: '/customers/add',
        element: <AddCustomerPage />
      },
      {
        path: '/customers/:id',
        element: <CustomerDetailPage />
      },
      {
        path: '/payments',
        element: <PaymentsPage />
      },
      {
        path: '/payments/add',
        element: <AddPaymentPage />
      },
      {
        path: '/reports',
        element: <ReportsPage />
      },
      {
        path: '/reports/daily',
        element: <DailyReportPage />
      },
      {
        path: '/reports/farmer-dues',
        element: <FarmerDuesReportPage />
      },
      {
        path: '/reports/customer-dues',
        element: <CustomerDuesReportPage />
      },
      {
        path: '/reports/collections',
        element: <CollectionsReportPage />
      },
      {
        path: '/reports/deliveries',
        element: <DeliveriesReportPage />
      },
      {
        path: '/reports/profit-loss',
        element: <ProfitLossReportPage />
      },
      {
        path: '/settings',
        element: <SettingsPage />
      },
      {
        path: '/settings/profile',
        element: <ProfilePage />
      },
      {
        path: '/settings/business',
        element: <BusinessSettingsPage />
      },
      {
        path: '/settings/staff',
        element: <StaffManagementPage />
      },
      {
        path: '/settings/rates',
        element: <RateSettingsPage />
      },
      {
        path: '/settings/sync',
        element: <SyncSettingsPage />
      },
      {
        path: '/settings/about',
        element: <AboutPage />
      },
      {
        path: '/routes',
        element: <RoutesPage />
      },
      {
        path: '/routes/add',
        element: <AddRoutePage />
      },
      {
        path: '/routes/:id',
        element: <RouteDetailPage />
      },
      {
        path: '/routes/:id/assign-users',
        element: <RouteAssignUsersPage />
      },
      {
        path: '/routes/:id/assign-farmers',
        element: <RouteAssignFarmersPage />
      },
      {
        path: '/routes/:id/assign-customers',
        element: <RouteAssignCustomersPage />
      },
      {
        path: '/more',
        element: <MorePage />
      }
    ]
  },

  // Catch all - redirect to home
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])
