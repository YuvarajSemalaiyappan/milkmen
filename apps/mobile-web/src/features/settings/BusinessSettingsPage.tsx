import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Phone, MapPin, Save } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Input } from '@/components/ui'
import { useAuthStore, selectIsOwner, selectIsManager } from '@/store'
import { api } from '@/services/api'
import type { ApiResponse, Business } from '@/types'

export function BusinessSettingsPage() {
  const { t } = useTranslation()
  const isOwner = useAuthStore(selectIsOwner)
  const isManager = useAuthStore(selectIsManager)
  const canEdit = isOwner || isManager

  const [business, setBusiness] = useState<Business | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  })

  useEffect(() => {
    loadBusiness()
  }, [])

  const loadBusiness = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<ApiResponse<Business>>('/settings/business')
      if (response.success && response.data) {
        setBusiness(response.data)
        setFormData({
          name: response.data.name,
          phone: response.data.phone,
          address: response.data.address || ''
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError(t('validation.required'))
      return
    }

    setIsSaving(true)
    try {
      const response = await api.put<ApiResponse<Business>>('/settings/business', {
        name: formData.name.trim(),
        address: formData.address.trim() || null
      })
      if (response.success && response.data) {
        setBusiness(response.data)
        setSuccess(t('common.success'))
        setIsEditing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell title={t('settings.business')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('settings.business')} showBack>
      <div className="px-4 pt-5 pb-4 space-y-4">
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

        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('settings.businessDetails')}
              </h2>
            </div>
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                {t('common.edit')}
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Input
                label={t('auth.businessName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.phone')}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formData.phone}</p>
                  <p className="text-xs text-gray-400">{t('settings.phoneCannotChange')}</p>
                </div>
              </div>

              <Input
                label={t('common.address')}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('common.optional')}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      name: business?.name || '',
                      phone: business?.phone || '',
                      address: business?.address || ''
                    })
                    setError('')
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {isSaving ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('auth.businessName')}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{business?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.phone')}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{business?.phone}</p>
                </div>
              </div>

              {business?.address && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.address')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{business.address}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {!canEdit && (
          <p className="text-sm text-center text-gray-500">
            {t('settings.onlyOwnerCanEdit')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
