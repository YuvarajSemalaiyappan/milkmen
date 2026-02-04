import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { Home, Milk, Truck, Users, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NavItem {
  path: string
  icon: typeof Home
  labelKey: string
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/collect', icon: Milk, labelKey: 'nav.collect' },
  { path: '/deliver', icon: Truck, labelKey: 'nav.deliver' },
  { path: '/farmers', icon: Users, labelKey: 'nav.farmers' },
  { path: '/more', icon: MoreHorizontal, labelKey: 'nav.more' }
]

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-bottom md:hidden z-40">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center flex-1 h-full px-2',
                'text-xs font-medium transition-colors',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    'w-6 h-6 mb-1',
                    isActive && 'stroke-[2.5]'
                  )}
                />
                <span>{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
