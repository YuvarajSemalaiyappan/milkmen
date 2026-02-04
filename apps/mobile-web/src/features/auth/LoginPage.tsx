import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Milk, Phone } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { PinPad } from '@/components/common'
import { useAuthStore, useAppStore } from '@/store'
import { syncService } from '@/services/syncService'

type Step = 'phone' | 'pin'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const addToast = useAppStore((state) => state.addToast)

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate phone number (10 digits)
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setError(t('validation.invalidPhone'))
      return
    }

    setStep('pin')
  }

  const handlePinComplete = async (enteredPin: string) => {
    setIsLoading(true)
    setError('')

    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, pin: enteredPin })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Login failed')
      }

      setUser(
        {
          id: result.data.user.id,
          businessId: result.data.user.businessId,
          name: result.data.user.name,
          phone: result.data.user.phone,
          role: result.data.user.role
        },
        result.data.token,
        result.data.refreshToken
      )

      addToast({
        type: 'success',
        message: t('auth.welcome')
      })

      // Pull data from server to populate local IndexedDB
      syncService.pullChanges().catch((err) => {
        console.error('Initial sync after login failed:', err)
      })

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'))
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex flex-col">
      {/* Logo */}
      <div className="pt-12 pb-6 text-center">
        <div className="w-18 h-18 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30" style={{ width: 72, height: 72 }}>
          <Milk className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Milkmen</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
          {t('auth.login')}
        </p>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex flex-col px-6">
        <Card className="w-full max-w-sm mx-auto" shadow="md" padding="lg">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <Input
                label={t('auth.phone')}
                type="tel"
                placeholder={t('auth.enterPhone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="w-5 h-5" />}
                error={error}
                autoFocus
              />
              <Button
                type="submit"
                fullWidth
                size="lg"
                disabled={phone.replace(/\D/g, '').length < 10}
              >
                {t('common.next')}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-1">{t('auth.enterPin')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{phone}</p>
                <button
                  onClick={() => {
                    setStep('phone')
                    setPin('')
                    setError('')
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 mt-2 hover:underline"
                >
                  {t('common.edit')}
                </button>
              </div>

              {error && (
                <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <PinPad
                value={pin}
                onChange={setPin}
                onComplete={handlePinComplete}
                length={4}
              />

              {isLoading && (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {t('common.loading')}
                </div>
              )}

              <button
                onClick={() => {/* TODO: Implement forgot PIN */}}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('auth.forgotPin')}
              </button>
            </div>
          )}
        </Card>

        {/* Register Link */}
        <div className="mt-8 pb-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">{t('auth.newHere')}</p>
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-lg hover:underline"
          >
            {t('auth.register')}
          </button>
        </div>
      </div>
    </div>
  )
}
