import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  Home,
  Milk,
  Truck,
  Users,
  UserCircle,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore, useAuthStore } from '@/store'

interface NavItem {
  path: string
  icon: typeof Home
  labelKey: string
}

const mainNavItems: NavItem[] = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/collect', icon: Milk, labelKey: 'nav.collect' },
  { path: '/deliver', icon: Truck, labelKey: 'nav.deliver' },
  { path: '/farmers', icon: Users, labelKey: 'nav.farmers' },
  { path: '/customers', icon: UserCircle, labelKey: 'nav.customers' },
  { path: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
  { path: '/reports', icon: BarChart3, labelKey: 'nav.reports' }
]

const bottomNavItems: NavItem[] = [
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' }
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Sidebar() {
  const { t } = useTranslation()
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <>
      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50',
          'flex flex-col transition-transform duration-300 ease-in-out',
          'md:translate-x-0 md:static md:z-auto',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo/Brand */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/20">
              <Milk className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Milkmen</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium',
                      'transition-colors',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-100 dark:border-gray-700 py-3 px-3">
          <ul className="space-y-1">
            {bottomNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium',
                      'transition-colors',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          {/* User info & logout */}
          {user && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {getInitials(user.name || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.phone}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout()
                  setSidebarOpen(false)
                }}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium',
                  'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors'
                )}
              >
                <LogOut className="w-5 h-5" />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
