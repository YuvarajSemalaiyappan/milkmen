import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, Plus, Trash2, Edit2, Save, X, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Input } from '@/components/ui'
import { useAuthStore, selectCanEditRates } from '@/store'
import { api } from '@/services/api'
import { formatCurrency } from '@/utils'
import type { ApiResponse, Rate } from '@/types'

export function RateSettingsPage() {
  const { t } = useTranslation()
  const canEdit = useAuthStore(selectCanEditRates)

  const [rates, setRates] = useState<Rate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingRate, setIsAddingRate] = useState(false)
  const [editingRate, setEditingRate] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newRate, setNewRate] = useState({
    fatFrom: '',
    fatTo: '',
    ratePerLiter: ''
  })

  const [editData, setEditData] = useState({
    fatFrom: '',
    fatTo: '',
    ratePerLiter: ''
  })

  useEffect(() => {
    loadRates()
  }, [])

  const loadRates = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<ApiResponse<Rate[]>>('/rates')
      if (response.success && response.data) {
        setRates(response.data.sort((a, b) => a.fatFrom - b.fatFrom))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const validateRate = (data: typeof newRate) => {
    const fatFrom = parseFloat(data.fatFrom)
    const fatTo = parseFloat(data.fatTo)
    const rate = parseFloat(data.ratePerLiter)

    if (isNaN(fatFrom) || fatFrom < 0 || fatFrom > 15) {
      return t('settings.invalidFatRange')
    }
    if (isNaN(fatTo) || fatTo < 0 || fatTo > 15) {
      return t('settings.invalidFatRange')
    }
    if (fatFrom >= fatTo) {
      return t('settings.fatFromMustBeLess')
    }
    if (isNaN(rate) || rate <= 0) {
      return t('validation.invalidRate')
    }
    return null
  }

  const handleAddRate = async () => {
    setError('')
    setSuccess('')

    const validationError = validateRate(newRate)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    try {
      const response = await api.post<ApiResponse<Rate>>('/rates', {
        fatFrom: parseFloat(newRate.fatFrom),
        fatTo: parseFloat(newRate.fatTo),
        ratePerLiter: parseFloat(newRate.ratePerLiter)
      })
      if (response.success && response.data) {
        setRates([...rates, response.data].sort((a, b) => a.fatFrom - b.fatFrom))
        setSuccess(t('settings.rateAdded'))
        setIsAddingRate(false)
        setNewRate({ fatFrom: '', fatTo: '', ratePerLiter: '' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateRate = async (rateId: string) => {
    setError('')
    setSuccess('')

    const validationError = validateRate(editData)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    try {
      const response = await api.put<ApiResponse<Rate>>(`/rates/${rateId}`, {
        fatFrom: parseFloat(editData.fatFrom),
        fatTo: parseFloat(editData.fatTo),
        ratePerLiter: parseFloat(editData.ratePerLiter)
      })
      if (response.success && response.data) {
        setRates(rates.map(r => r.id === rateId ? response.data! : r).sort((a, b) => a.fatFrom - b.fatFrom))
        setSuccess(t('settings.rateUpdated'))
        setEditingRate(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRate = async (rateId: string) => {
    setError('')
    if (!confirm(t('settings.confirmDeleteRate'))) return

    try {
      await api.delete<ApiResponse<void>>(`/rates/${rateId}`)
      setRates(rates.filter(r => r.id !== rateId))
      setSuccess(t('settings.rateDeleted'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const startEditing = (rate: Rate) => {
    setEditingRate(rate.id)
    setEditData({
      fatFrom: rate.fatFrom.toString(),
      fatTo: rate.fatTo.toString(),
      ratePerLiter: rate.ratePerLiter.toString()
    })
    setError('')
  }

  return (
    <AppShell title={t('settings.rates')} showBack>
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

        {/* Info Card */}
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">{t('settings.fatBasedPricing')}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t('settings.fatBasedPricingDescription')}
              </p>
            </div>
          </div>
        </Card>

        {/* Add Rate Button */}
        {canEdit && !isAddingRate && (
          <Button
            className="w-full"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddingRate(true)}
          >
            {t('settings.addRateSlab')}
          </Button>
        )}

        {/* Add Rate Form */}
        {isAddingRate && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">{t('settings.addRateSlab')}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('settings.fatFrom')}
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  value={newRate.fatFrom}
                  onChange={(e) => setNewRate({ ...newRate, fatFrom: e.target.value })}
                  placeholder="3.0"
                  required
                />
                <Input
                  label={t('settings.fatTo')}
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  value={newRate.fatTo}
                  onChange={(e) => setNewRate({ ...newRate, fatTo: e.target.value })}
                  placeholder="4.0"
                  required
                />
              </div>

              <Input
                label={t('collection.ratePerLiter')}
                type="number"
                step="0.01"
                min="0"
                value={newRate.ratePerLiter}
                onChange={(e) => setNewRate({ ...newRate, ratePerLiter: e.target.value })}
                leftIcon={<span className="text-gray-500">₹</span>}
                placeholder="45.00"
                required
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddingRate(false)
                    setNewRate({ fatFrom: '', fatTo: '', ratePerLiter: '' })
                    setError('')
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddRate}
                  disabled={isSaving}
                >
                  {isSaving ? t('common.loading') : t('common.add')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Rate Slabs List */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            {t('common.loading')}
          </div>
        ) : rates.length === 0 ? (
          <Card className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('settings.noRates')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('settings.noRatesDescription')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rates.map((rate) => (
              <Card key={rate.id} padding="none">
                {editingRate === rate.id ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label={t('settings.fatFrom')}
                        type="number"
                        step="0.1"
                        min="0"
                        max="15"
                        value={editData.fatFrom}
                        onChange={(e) => setEditData({ ...editData, fatFrom: e.target.value })}
                        required
                      />
                      <Input
                        label={t('settings.fatTo')}
                        type="number"
                        step="0.1"
                        min="0"
                        max="15"
                        value={editData.fatTo}
                        onChange={(e) => setEditData({ ...editData, fatTo: e.target.value })}
                        required
                      />
                    </div>

                    <Input
                      label={t('collection.ratePerLiter')}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editData.ratePerLiter}
                      onChange={(e) => setEditData({ ...editData, ratePerLiter: e.target.value })}
                      leftIcon={<span className="text-gray-500">₹</span>}
                      required
                    />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRate(null)
                          setError('')
                        }}
                        leftIcon={<X className="w-4 h-4" />}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRate(rate.id)}
                        disabled={isSaving}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        {isSaving ? t('common.loading') : t('common.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('settings.fatRange')}: {rate.fatFrom}% - {rate.fatTo}%
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(rate.ratePerLiter)}{t('common.perLiter')}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={() => startEditing(rate)}
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => handleDeleteRate(rate.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-center text-gray-500">
            {t('settings.onlyOwnerCanEdit')}
          </p>
        )}
      </div>
    </AppShell>
  )
}
