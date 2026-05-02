import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore, useAppStore } from '@/store'

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

function ScrollToTop() {
  const location = useLocation()
  const renderCount = useRef(0)
  renderCount.current++
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <div data-debug-stt style={{ position: 'fixed', top: 56, right: 0, background: 'green', color: 'white', padding: '4px 8px', fontSize: 11, zIndex: 9999, fontFamily: 'monospace' }}>
      STT r#{renderCount.current} loc={location.pathname}
    </div>
  )
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const subscription = useAuthStore((state) => state.subscription)
  const addToast = useAppStore((state) => state.addToast)
  const location = useLocation()
  const expiryWarningShown = useRef(false)
  const renderCount = useRef(0)
  renderCount.current++

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

  return (
    <>
      <div data-debug style={{ position: 'fixed', top: 0, right: 0, background: 'red', color: 'white', padding: '4px 8px', fontSize: 11, zIndex: 9999, fontFamily: 'monospace' }}>
        r#{renderCount.current} loc={location.pathname} t={Date.now() % 100000}
      </div>
      <Outlet />
    </>
  )
}

function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()
  const renderCount = useRef(0)
  renderCount.current++

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <div data-debug-public style={{ position: 'fixed', top: 28, right: 0, background: 'blue', color: 'white', padding: '4px 8px', fontSize: 11, zIndex: 9999, fontFamily: 'monospace' }}>
        PUB r#{renderCount.current} loc={location.pathname}
      </div>
      <Outlet />
    </>
  )
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/collect" element={<CollectionsPage />} />
          <Route path="/collect/add" element={<AddCollectionPage />} />
          <Route path="/collect/:id" element={<CollectionDetailPage />} />
          <Route path="/deliver" element={<DeliveriesPage />} />
          <Route path="/deliver/today" element={<TodayDeliveriesPage />} />
          <Route path="/deliver/add" element={<AddDeliveryPage />} />
          <Route path="/deliver/edit/:id" element={<DeliveryDetailPage />} />
          <Route path="/deliver/:id" element={<DeliveryDetailPage />} />
          <Route path="/farmers" element={<FarmersPage />} />
          <Route path="/farmers/add" element={<AddFarmerPage />} />
          <Route path="/farmers/:id" element={<FarmerDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/add" element={<AddCustomerPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/add" element={<AddPaymentPage />} />
          <Route path="/payments/history" element={<PaymentHistoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/daily" element={<DailyReportPage />} />
          <Route path="/reports/farmer-dues" element={<FarmerDuesReportPage />} />
          <Route path="/reports/customer-dues" element={<CustomerDuesReportPage />} />
          <Route path="/reports/collections" element={<CollectionsReportPage />} />
          <Route path="/reports/deliveries" element={<DeliveriesReportPage />} />
          <Route path="/reports/profit-loss" element={<ProfitLossReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
          <Route path="/settings/business" element={<BusinessSettingsPage />} />
          <Route path="/settings/staff" element={<StaffManagementPage />} />
          <Route path="/settings/subscription" element={<SubscriptionPage />} />
          <Route path="/settings/rates" element={<RateSettingsPage />} />
          <Route path="/settings/about" element={<AboutPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/routes/add" element={<AddRoutePage />} />
          <Route path="/routes/:id" element={<RouteDetailPage />} />
          <Route path="/routes/:id/assign-users" element={<RouteAssignUsersPage />} />
          <Route path="/routes/:id/assign-farmers" element={<RouteAssignFarmersPage />} />
          <Route path="/routes/:id/assign-customers" element={<RouteAssignCustomersPage />} />
          <Route path="/routes/:routeId/areas" element={<AreasPage />} />
          <Route path="/routes/:routeId/areas/add" element={<AddAreaPage />} />
          <Route path="/routes/:routeId/areas/:areaId" element={<AreaDetailPage />} />
          <Route path="/routes/:routeId/areas/:areaId/assign-customers" element={<AreaAssignCustomersPage />} />
          <Route path="/routes/:routeId/areas/:areaId/assign-farmers" element={<AreaAssignFarmersPage />} />
          <Route path="/more" element={<MorePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
