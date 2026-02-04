import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Menu, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { SyncIndicator } from '@/components/common'

export interface HeaderProps {
  title?: string
  showBack?: boolean
  showMenu?: boolean
  rightAction?: React.ReactNode
}

export function Header({
  title,
  showBack = false,
  showMenu = false,
  rightAction
}: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  // Get page title from route if not provided
  const pageTitle = title || getPageTitle(location.pathname, t)

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
          {showMenu && (
            <button
              onClick={toggleSidebar}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors hidden md:block"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <SyncIndicator showLabel={false} />
          {rightAction || (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('nav.settings')}
            >
              <Settings className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function getPageTitle(pathname: string, t: (key: string) => string): string {
  const routes: Record<string, string> = {
    '/': 'dashboard.title',
    '/collect': 'collection.title',
    '/deliver': 'delivery.title',
    '/farmers': 'farmer.title',
    '/customers': 'customer.title',
    '/payments': 'payment.title',
    '/reports': 'reports.title',
    '/settings': 'settings.title',
    '/more': 'nav.more'
  }

  const key = routes[pathname]
  return key ? t(key) : 'Milkmen'
}
