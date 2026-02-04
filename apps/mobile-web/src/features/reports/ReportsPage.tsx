import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Users,
  UserCircle,
  Milk,
  Truck,
  TrendingUp,
  ChevronRight
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

interface ReportItem {
  titleKey: string
  icon: typeof BarChart3
  path: string
  color: string
}

const reports: ReportItem[] = [
  {
    titleKey: 'reports.daily',
    icon: BarChart3,
    path: '/reports/daily',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    titleKey: 'reports.farmerDues',
    icon: Users,
    path: '/reports/farmer-dues',
    color: 'bg-green-100 text-green-600'
  },
  {
    titleKey: 'reports.customerDues',
    icon: UserCircle,
    path: '/reports/customer-dues',
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    titleKey: 'reports.collections',
    icon: Milk,
    path: '/reports/collections',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    titleKey: 'reports.deliveries',
    icon: Truck,
    path: '/reports/deliveries',
    color: 'bg-pink-100 text-pink-600'
  },
  {
    titleKey: 'reports.profitLoss',
    icon: TrendingUp,
    path: '/reports/profit-loss',
    color: 'bg-indigo-100 text-indigo-600'
  }
]

export function ReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <AppShell title={t('reports.title')}>
      <div className="px-4 pt-5 pb-4">
        <Card padding="none">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {reports.map((report) => (
              <li key={report.path}>
                <button
                  onClick={() => navigate(report.path)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className={`p-3 rounded-lg ${report.color}`}>
                    <report.icon className="w-5 h-5" />
                  </div>
                  <span className="flex-1 text-left font-medium text-gray-900 dark:text-white">
                    {t(report.titleKey)}
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
