import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Phone, User, Lock, ArrowRight, Milk } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { useAuthStore } from '@/store'
import { clsx } from 'clsx'

const phoneSchema = z.string().refine(
  (val) => /^[6-9]\d{9}$/.test(val.replace(/\D/g, '')),
  'Enter valid 10-digit mobile number'
)

const registerSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  businessPhone: phoneSchema,
  ownerName: z.string().min(2, 'Name must be at least 2 characters'),
  ownerPhone: phoneSchema,
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
  confirmPin: z.string()
}).refine((data) => data.pin === data.confirmPin, {
  message: 'PINs do not match',
  path: ['confirmPin']
})

type RegisterFormData = z.infer<typeof registerSchema>

const steps = ['business', 'owner', 'pin'] as const

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<'business' | 'owner' | 'pin'>('business')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const currentStepIndex = steps.indexOf(step)

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      businessName: '',
      businessPhone: '',
      ownerName: '',
      ownerPhone: '',
      pin: '',
      confirmPin: ''
    }
  })

  const handleNextStep = async () => {
    if (step === 'business') {
      const isValid = await trigger(['businessName', 'businessPhone'])
      if (isValid) setStep('owner')
    } else if (step === 'owner') {
      const isValid = await trigger(['ownerName', 'ownerPhone'])
      if (isValid) setStep('pin')
    }
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true)
      setError('')

      // Call registration API
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          phone: data.businessPhone.replace(/\D/g, ''),
          ownerName: data.ownerName,
          pin: data.pin
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Registration failed')
      }

      // Auto-login after registration
      useAuthStore.getState().setUser(
        result.data.user,
        result.data.token,
        result.data.refreshToken
      )

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepLabels = [t('auth.business'), t('auth.owner'), t('auth.security')]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex flex-col">
      {/* Header */}
      <div className="pt-8 pb-3 px-6 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <Milk className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('auth.createAccount')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">{t('auth.registerSubtitle')}</p>
      </div>

      {/* Progress Steps */}
      <div className="px-6 mb-4">
        <div className="flex items-center justify-center max-w-xs mx-auto">
          {steps.map((s, i) => {
            const isActive = i === currentStepIndex
            const isCompleted = i < currentStepIndex
            return (
              <div key={s} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : isCompleted
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={clsx(
                      'text-xs mt-1.5 font-medium',
                      isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'
                    )}
                  >
                    {stepLabels[i]}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={clsx(
                      'flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors',
                      i < currentStepIndex ? 'bg-blue-400' : 'bg-gray-200 dark:bg-gray-600'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-2">
        <Card className="max-w-md mx-auto" shadow="md" padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Business Details */}
            {step === 'business' && (
              <>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  {t('auth.businessDetails')}
                </h2>

                <Input
                  label={t('auth.businessName')}
                  placeholder="e.g., Murugan Milk Supply"
                  error={errors.businessName?.message}
                  leftIcon={<Building2 className="w-5 h-5" />}
                  {...register('businessName')}
                />

                <Input
                  label={t('auth.businessPhone')}
                  type="tel"
                  placeholder="10-digit mobile number"
                  error={errors.businessPhone?.message}
                  leftIcon={<Phone className="w-5 h-5" />}
                  {...register('businessPhone')}
                />

                <Button
                  type="button"
                  onClick={handleNextStep}
                  fullWidth
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('common.next')}
                </Button>
              </>
            )}

            {/* Step 2: Owner Details */}
            {step === 'owner' && (
              <>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  {t('auth.ownerDetails')}
                </h2>

                <Input
                  label={t('auth.ownerName')}
                  placeholder="Your full name"
                  error={errors.ownerName?.message}
                  leftIcon={<User className="w-5 h-5" />}
                  {...register('ownerName')}
                />

                <Input
                  label={t('auth.ownerPhone')}
                  type="tel"
                  placeholder="Your mobile number"
                  error={errors.ownerPhone?.message}
                  leftIcon={<Phone className="w-5 h-5" />}
                  {...register('ownerPhone')}
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('business')}
                    fullWidth
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    fullWidth
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: PIN Setup */}
            {step === 'pin' && (
              <>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  {t('auth.setupPin')}
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('auth.pinDescription')}
                </p>

                <Input
                  label={t('auth.enterPin')}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  error={errors.pin?.message}
                  leftIcon={<Lock className="w-5 h-5" />}
                  {...register('pin')}
                />

                <Input
                  label={t('auth.confirmPin')}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm PIN"
                  error={errors.confirmPin?.message}
                  leftIcon={<Lock className="w-5 h-5" />}
                  {...register('confirmPin')}
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('owner')}
                    fullWidth
                  >
                    {t('common.back')}
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    fullWidth
                  >
                    {t('auth.createAccount')}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
