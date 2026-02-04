import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Phone, Lock, Eye, EyeOff, Save } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Input } from '@/components/ui'
import { useAuthStore } from '@/store'
import { authApi } from '@/services/api'

export function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)

  const [isChangingPin, setIsChangingPin] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showCurrentPin, setShowCurrentPin] = useState(false)
  const [showNewPin, setShowNewPin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChangePin = async () => {
    setError('')
    setSuccess('')

    if (!currentPin || currentPin.length !== 4) {
      setError(t('validation.invalidPin'))
      return
    }

    if (!newPin || newPin.length !== 4) {
      setError(t('validation.invalidPin'))
      return
    }

    if (newPin !== confirmPin) {
      setError(t('auth.pinMismatch'))
      return
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError(t('validation.invalidPin'))
      return
    }

    setIsLoading(true)
    try {
      await authApi.changePin(user!.id, currentPin, newPin)
      setSuccess(t('settings.pinChanged'))
      setIsChangingPin(false)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return t('settings.roleOwner')
      case 'MANAGER':
        return t('settings.roleManager')
      case 'STAFF':
        return t('settings.roleStaff')
      default:
        return role
    }
  }

  return (
    <AppShell title={t('settings.profile')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
        {/* Profile Info */}
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{getRoleLabel(user?.role || 'STAFF')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.phone')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{user?.phone}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Change PIN Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{t('settings.changePin')}</span>
            </div>
            {!isChangingPin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangingPin(true)}
              >
                {t('common.edit')}
              </Button>
            )}
          </div>

          {isChangingPin && (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div className="relative">
                <Input
                  type={showCurrentPin ? 'text' : 'password'}
                  label={t('settings.currentPin')}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <button
                  type="button"
                  className="absolute right-3 top-9 text-gray-500"
                  onClick={() => setShowCurrentPin(!showCurrentPin)}
                >
                  {showCurrentPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showNewPin ? 'text' : 'password'}
                  label={t('settings.newPin')}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <button
                  type="button"
                  className="absolute right-3 top-9 text-gray-500"
                  onClick={() => setShowNewPin(!showNewPin)}
                >
                  {showNewPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Input
                type="password"
                label={t('auth.confirmPin')}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsChangingPin(false)
                    setCurrentPin('')
                    setNewPin('')
                    setConfirmPin('')
                    setError('')
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleChangePin}
                  disabled={isLoading}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {isLoading ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
