import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  UserCircle,
  CreditCard,
  BarChart3,
  Settings,
  ChevronRight
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

interface MenuItem {
  icon: typeof UserCircle
  titleKey: string
  path: string
  color: string
}

const menuItems: MenuItem[] = [
  {
    icon: UserCircle,
    titleKey: 'nav.customers',
    path: '/customers',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    icon: CreditCard,
    titleKey: 'nav.payments',
    path: '/payments',
    color: 'bg-green-100 text-green-600'
  },
  {
    icon: BarChart3,
    titleKey: 'nav.reports',
    path: '/reports',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    icon: Settings,
    titleKey: 'nav.settings',
    path: '/settings',
    color: 'bg-gray-100 text-gray-600'
  }
]

export function MorePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <AppShell title={t('nav.more')}>
      <div className="px-4 pt-5 pb-4">
        <Card padding="none">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {menuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className={`p-3 rounded-lg ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="flex-1 text-left font-medium text-gray-900 dark:text-white">
                    {t(item.titleKey)}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  )
}
