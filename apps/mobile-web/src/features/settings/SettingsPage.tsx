import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Globe,
  User,
  Building2,
  Users,
  DollarSign,
  RefreshCw,
  Info,
  LogOut,
  ChevronRight,
  Check,
  Sun,
  Moon,
  Monitor,
  MapPin,
  Crown
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { useAuthStore, useAppStore, type Theme } from '@/store'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)

  const currentLanguage = i18n.language

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
  }

  const settingsItems = [
    {
      icon: User,
      titleKey: 'settings.profile',
      path: '/settings/profile',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: Crown,
      titleKey: 'settings.subscription',
      path: '/settings/subscription',
      color: 'bg-indigo-100 text-indigo-600'
    },
    {
      icon: Building2,
      titleKey: 'settings.business',
      path: '/settings/business',
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: Users,
      titleKey: 'settings.staff',
      path: '/settings/staff',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      icon: MapPin,
      titleKey: 'routes.title',
      path: '/routes',
      color: 'bg-orange-100 text-orange-600'
    },
    {
      icon: DollarSign,
      titleKey: 'settings.rates',
      path: '/settings/rates',
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      icon: RefreshCw,
      titleKey: 'settings.sync',
      path: '/settings/sync',
      color: 'bg-pink-100 text-pink-600'
    },
    {
      icon: Info,
      titleKey: 'settings.about',
      path: '/settings/about',
      color: 'bg-gray-100 text-gray-600'
    }
  ]

  return (
    <AppShell title={t('settings.title')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* User Info */}
        {user && (
          <Card className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.phone}</p>
            </div>
          </Card>
        )}

        {/* Language Selection */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {t('settings.language')}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                currentLanguage === 'en'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {currentLanguage === 'en' && <Check className="w-4 h-4" />}
                {t('settings.english')}
              </div>
            </button>
            <button
              onClick={() => handleLanguageChange('ta')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                currentLanguage === 'ta'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {currentLanguage === 'ta' && <Check className="w-4 h-4" />}
                {t('settings.tamil')}
              </div>
            </button>
          </div>
        </Card>

        {/* Theme Selection */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {t('settings.theme')}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleThemeChange('light')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sun className="w-4 h-4" />
                {t('settings.light')}
              </div>
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                theme === 'dark'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Moon className="w-4 h-4" />
                {t('settings.dark')}
              </div>
            </button>
            <button
              onClick={() => handleThemeChange('system')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                theme === 'system'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Monitor className="w-4 h-4" />
                {t('settings.system')}
              </div>
            </button>
          </div>
        </Card>

        {/* Settings Menu */}
        <Card padding="none">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {settingsItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${item.color}`}>
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

        {/* Logout */}
        <Card padding="none">
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="w-full flex items-center gap-4 p-4 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
          >
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="font-medium">{t('auth.logout')}</span>
          </button>
        </Card>

        {/* Version */}
        <p className="text-center text-sm text-gray-400">
          {t('settings.version')} 1.0.0
        </p>
      </div>
    </AppShell>
  )
}
