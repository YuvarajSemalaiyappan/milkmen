import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Action, Location, To } from 'react-router-dom'
import { Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
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

// Custom history + subscriber registry. We bypass BrowserRouter's internal
// subscription (which was failing to fire for navigations between protected
// routes) and feed React state directly via useSyncExternalStore.

type RouterLocation = Location

const subscribers = new Set<() => void>()

function buildLocation(state: unknown): RouterLocation {
  const s = (state as { key?: string; usr?: unknown } | null) ?? null
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: s?.usr ?? null,
    key: s?.key ?? 'default'
  }
}

let action: Action = 'POP' as Action
let snapshot = { action, location: buildLocation(window.history.state) }

function notify(nextAction: Action, nextState: unknown) {
  action = nextAction
  snapshot = { action: nextAction, location: buildLocation(nextState) }
  subscribers.forEach((fn) => fn())
}

const origPush = window.history.pushState.bind(window.history)
const origReplace = window.history.replaceState.bind(window.history)
window.history.pushState = function (state, ...rest) {
  origPush(state, ...rest)
  notify('PUSH' as Action, state)
}
window.history.replaceState = function (state, ...rest) {
  origReplace(state, ...rest)
  notify('REPLACE' as Action, state)
}
window.addEventListener('popstate', () => {
  notify('POP' as Action, window.history.state)
})

const navigator = {
  createHref: (to: To) => (typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`),
  encodeLocation: (to: To): { pathname: string; search: string; hash: string } => {
    if (typeof to === 'string') {
      const url = new URL(to, window.location.origin)
      return { pathname: url.pathname, search: url.search, hash: url.hash }
    }
    return { pathname: to.pathname ?? '', search: to.search ?? '', hash: to.hash ?? '' }
  },
  push: (to: To, state?: unknown) => {
    const key = Math.random().toString(36).slice(2, 10)
    const href = typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`
    origPush({ usr: state ?? null, key, idx: 0 }, '', href)
    notify('PUSH' as Action, { usr: state ?? null, key })
  },
  replace: (to: To, state?: unknown) => {
    const key = Math.random().toString(36).slice(2, 10)
    const href = typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`
    origReplace({ usr: state ?? null, key, idx: 0 }, '', href)
    notify('REPLACE' as Action, { usr: state ?? null, key })
  },
  go: (delta: number) => window.history.go(delta)
}

function subscribe(fn: () => void) {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}
function getSnapshot() {
  return snapshot
}

function HistoryRouter({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return (
    <Router
      basename=""
      location={state.location}
      navigationType={state.action}
      navigator={navigator}
    >
      {children}
    </Router>
  )
}

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return null
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const subscription = useAuthStore((state) => state.subscription)
  const addToast = useAppStore((state) => state.addToast)
  const expiryWarningShown = useRef(false)

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

function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function AppRoutes() {
  return (
    <HistoryRouter>
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
    </HistoryRouter>
  )
}
