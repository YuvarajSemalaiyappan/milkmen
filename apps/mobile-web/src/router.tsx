import { useEffect, useRef } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, useAppStore } from '@/store'
import { syncService } from '@/services/syncService'

// Feature pages
import { DashboardPage } from '@/features/dashboard'
import { FarmersPage, AddFarmerPage, FarmerDetailPage } from '@/features/farmers'
import { CustomersPage, AddCustomerPage, CustomerDetailPage } from '@/features/customers'
import { CollectionsPage, AddCollectionPage, CollectionDetailPage } from '@/features/collections'
import { DeliveriesPage, AddDeliveryPage, TodayDeliveriesPage, DeliveryDetailPage } from '@/features/deliveries'
import { PaymentsPage, AddPaymentPage, PaymentHistoryPage } from '@/features/payments'
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
  SubscriptionPage,
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
import {
  AreasPage,
  AddAreaPage,
  AreaDetailPage,
  AreaAssignCustomersPage,
  AreaAssignFarmersPage
} from '@/features/areas'
import { MorePage } from '@/features/more'
import { LoginPage, RegisterPage } from '@/features/auth'

// Protected route wrapper
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const subscription = useAuthStore((state) => state.subscription)
  const addToast = useAppStore((state) => state.addToast)
  const expiryWarningShown = useRef(false)

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

  // Show expiry warning toast
  useEffect(() => {
    if (!subscription || expiryWarningShown.current) return
    expiryWarningShown.current = true

    if (subscription.daysRemaining <= 0) {
      addToast({ type: 'error', message: 'Your plan has expired. Contact admin to renew.', duration: 5000 })
    } else if (subscription.daysRemaining <= 7) {
      addToast({ type: 'warning', message: `Your plan expires in ${subscription.daysRemaining} days`, duration: 5000 })
    }
  }, [subscription, addToast])

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
        path: '/deliver/today',
        element: <TodayDeliveriesPage />
      },
      {
        path: '/deliver/add',
        element: <AddDeliveryPage />
      },
      {
        path: '/deliver/edit/:id',
        element: <DeliveryDetailPage />
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
        path: '/payments/history',
        element: <PaymentHistoryPage />
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
        path: '/settings/subscription',
        element: <SubscriptionPage />
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
        path: '/routes/:routeId/areas',
        element: <AreasPage />
      },
      {
        path: '/routes/:routeId/areas/add',
        element: <AddAreaPage />
      },
      {
        path: '/routes/:routeId/areas/:areaId',
        element: <AreaDetailPage />
      },
      {
        path: '/routes/:routeId/areas/:areaId/assign-customers',
        element: <AreaAssignCustomersPage />
      },
      {
        path: '/routes/:routeId/areas/:areaId/assign-farmers',
        element: <AreaAssignFarmersPage />
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
