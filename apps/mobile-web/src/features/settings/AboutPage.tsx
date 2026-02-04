import { useTranslation } from 'react-i18next'
import { Info, Heart, Code, Globe, Mail, ExternalLink } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

export function AboutPage() {
  const { t } = useTranslation()

  return (
    <AppShell title={t('settings.about')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* App Info */}
        <Card className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-3xl">🥛</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('about.appName')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('about.tagline')}</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('settings.version')}</span>
            <span className="font-mono font-semibold text-gray-900 dark:text-white">1.0.0</span>
          </div>
        </Card>

        {/* Features */}
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t('about.features')}
          </h3>
          <ul className="space-y-3">
            {[
              t('about.feature1'),
              t('about.feature2'),
              t('about.feature3'),
              t('about.feature4'),
              t('about.feature5')
            ].map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2" />
                <span className="text-gray-600 dark:text-gray-300">{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Developer Info */}
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            {t('about.developer')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                  <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('about.madeWith')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('about.developerName')}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Contact & Links */}
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            {t('about.contact')}
          </h3>
          <div className="space-y-2">
            <a
              href="mailto:support@milkmen.app"
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200">{t('about.email')}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
            <a
              href="https://milkmen.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200">{t('about.website')}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </Card>

        {/* Tech Stack */}
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('about.techStack')}</h3>
          <div className="flex flex-wrap gap-2">
            {['React 19', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Dexie.js', 'Express', 'Prisma', 'PostgreSQL'].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 py-4">
          © {new Date().getFullYear()} Milkmen. {t('about.allRightsReserved')}
        </p>
      </div>
    </AppShell>
  )
}
