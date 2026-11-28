import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguagePicker } from '@/components/common/LanguagePicker'
import { isLanguage, LANGUAGES, type Language } from '@/i18n/languages'
import { Users, Plus, Phone, Shield, MoreVertical, Key, Trash2, UserX, UserCheck, Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button, Input, Badge, InlineLoader } from '@/components/ui'
import { useAuthStore, selectIsOwner } from '@/store'
import { api, orderShareApi } from '@/services/api'
import type { ApiResponse, User, Role } from '@/types'

const languageName = (code?: string | null) => LANGUAGES.find((l) => l.code === code)?.label

interface StaffMember extends User {
  isActive: boolean
  /** Whose collect/deliver order they follow (null = their own); see server lib/order-follow.ts */
  followFarmerOrderId?: string | null
  followCustomerOrderId?: string | null
}

export function StaffManagementPage() {
  const { t, i18n } = useTranslation()
  const isOwner = useAuthStore(selectIsOwner)
  const currentUser = useAuthStore((state) => state.user)

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Which menu action is running (e.g. 'delete:<id>'): it spins, the others wait
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busyAction) return
    setBusyAction(key)
    try {
      await fn()
    } finally {
      setBusyAction(null)
    }
  }
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    pin: '',
    role: 'STAFF' as Role
  })
  // The new person's app language; null = the owner's own language (same as the phone app)
  const [newLanguage, setNewLanguage] = useState<Language | null>(null)
  const staffLanguage = newLanguage ?? (isLanguage(i18n.language) ? i18n.language : 'en')


  const loadStaff = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get<ApiResponse<StaffMember[]>>('/settings/staff')
      if (response.success && response.data) {
        setStaff(response.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (isOwner) {
      loadStaff()
    }
  }, [isOwner, loadStaff])

  const handleAddStaff = async () => {
    setError('')
    setSuccess('')

    if (!newStaff.name.trim()) {
      setError(t('validation.required'))
      return
    }

    if (!newStaff.phone || !/^\d{10}$/.test(newStaff.phone)) {
      setError(t('validation.invalidPhone'))
      return
    }

    if (!newStaff.pin || !/^\d{4}$/.test(newStaff.pin)) {
      setError(t('validation.invalidPin'))
      return
    }

    setIsSaving(true)
    try {
      const response = await api.post<ApiResponse<StaffMember>>('/settings/staff', {
        name: newStaff.name.trim(),
        phone: newStaff.phone,
        pin: newStaff.pin,
        role: newStaff.role,
        language: staffLanguage
      })
      if (response.success && response.data) {
        setStaff([...staff, response.data])
        setSuccess(t('settings.staffAdded'))
        setIsAddingStaff(false)
        setNewStaff({ name: '', phone: '', pin: '', role: 'STAFF' })
        setNewLanguage(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPin = async (staffId: string) => {
    setError('')
    setSuccess('')
    await runAction(`pin:${staffId}`, async () => {
      try {
        await api.post<ApiResponse<{ tempPin: string }>>(`/settings/staff/${staffId}/reset-pin`)
        setSuccess(t('settings.pinResetSuccess'))
        setActiveMenu(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
    })
  }

  const handleToggleActive = async (staffMember: StaffMember) => {
    setError('')
    await runAction(`active:${staffMember.id}`, async () => {
      try {
        await api.put<ApiResponse<StaffMember>>(`/settings/staff/${staffMember.id}`, {
          isActive: !staffMember.isActive
        })
        setStaff(staff.map(s =>
          s.id === staffMember.id ? { ...s, isActive: !s.isActive } : s
        ))
        setActiveMenu(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
    })
  }

  const handleDeleteStaff = async (staffId: string) => {
    setError('')
    if (!confirm(t('settings.confirmDeleteStaff'))) return

    await runAction(`delete:${staffId}`, async () => {
      try {
        await api.delete<ApiResponse<void>>(`/settings/staff/${staffId}`)
        setStaff(staff.filter(s => s.id !== staffId))
        setSuccess(t('settings.staffDeleted'))
        setActiveMenu(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
    })
  }

  const getRoleLabel = (role: Role) => {
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

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'OWNER':
        return 'info' as const
      case 'MANAGER':
        return 'warning' as const
      default:
        return 'default' as const
    }
  }

  if (!isOwner) {
    return (
      <AppShell title={t('settings.staff')} showBack>
        <div className="p-4">
          <Card className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('settings.ownerOnlyFeature')}</p>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('settings.staff')} showBack>
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

        {/* Add Staff Button */}
        {!isAddingStaff && (
          <Button
            className="w-full"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddingStaff(true)}
          >
            {t('settings.addStaff')}
          </Button>
        )}

        {/* Add Staff Form */}
        {isAddingStaff && (
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('settings.addStaff')}</h3>
            <div className="space-y-4">
              <Input
                label={t('common.name')}
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                required
              />

              <Input
                label={t('common.phone')}
                type="tel"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                maxLength={10}
                inputMode="numeric"
                required
              />

              <Input
                label={t('auth.createPin')}
                type="password"
                value={newStaff.pin}
                onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                maxLength={4}
                inputMode="numeric"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('settings.role')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      newStaff.role === 'STAFF'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                    onClick={() => setNewStaff({ ...newStaff, role: 'STAFF' })}
                  >
                    {t('settings.roleStaff')}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      newStaff.role === 'MANAGER'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                    onClick={() => setNewStaff({ ...newStaff, role: 'MANAGER' })}
                  >
                    {t('settings.roleManager')}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('settings.language')}</p>
                <LanguagePicker value={staffLanguage} onChange={setNewLanguage} />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddingStaff(false)
                    setNewStaff({ name: '', phone: '', pin: '', role: 'STAFF' })
                    setError('')
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddStaff}
                  isLoading={isSaving}
                >
                  {isSaving ? t('common.loading') : t('common.add')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Staff List */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <InlineLoader label={t('common.loading')} />
          </div>
        ) : staff.length === 0 ? (
          <Card className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">{t('settings.noStaff')}</p>
          </Card>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff.map((member) => (
                <li key={member.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        member.isActive ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          member.isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${member.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                            {member.name}
                          </p>
                          <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                            {getRoleLabel(member.role)}
                          </Badge>
                          {!member.isActive && (
                            <Badge variant="error" size="sm">
                              {t('settings.inactive')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Phone className="w-3 h-3" />
                          {member.phone}
                          {languageName(member.language) ? ` · ${languageName(member.language)}` : ''}
                        </div>
                      </div>
                    </div>

                    {member.id !== currentUser?.id && member.role !== 'OWNER' && (
                      <div className="relative">
                        <button
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={() => setActiveMenu(activeMenu === member.id ? null : member.id)}
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500" />
                        </button>

                        {activeMenu === member.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setActiveMenu(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-20">
                              <button
                                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                onClick={() => handleResetPin(member.id)}
                                disabled={!!busyAction}
                              >
                                {busyAction === `pin:${member.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                <span>{t('settings.resetPin')}</span>
                              </button>
                              <button
                                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                onClick={() => handleToggleActive(member)}
                                disabled={!!busyAction}
                              >
                                {busyAction === `active:${member.id}` ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{member.isActive ? t('settings.deactivate') : t('settings.activate')}</span>
                                  </>
                                ) : member.isActive ? (
                                  <>
                                    <UserX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    <span>{t('settings.deactivate')}</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    <span>{t('settings.activate')}</span>
                                  </>
                                )}
                              </button>
                              <button
                                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                                onClick={() => handleDeleteStaff(member.id)}
                                disabled={!!busyAction}
                              >
                                {busyAction === `delete:${member.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Whose collect/deliver order this person uses: their own, or follow someone (live, read-only) */}
                  {member.id !== currentUser?.id && member.role !== 'OWNER' && member.isActive && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {(['farmer', 'customer'] as const).map((kind) => {
                        const value = (kind === 'farmer' ? member.followFarmerOrderId : member.followCustomerOrderId) ?? ''
                        return (
                          <label key={kind} className="block text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              {kind === 'farmer' ? t('order.farmersOrder') : t('order.customersOrder')}
                              {busyAction === `follow-${kind}:${member.id}` && <Loader2 className="w-3 h-3 animate-spin" />}
                            </span>
                            <select
                              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              value={value}
                              disabled={!!busyAction}
                              onChange={(e) => {
                                const v = e.target.value
                                runAction(`follow-${kind}:${member.id}`, async () => {
                                  try {
                                    await orderShareApi.follow(kind, v || null, member.id)
                                    await loadStaff()
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : t('common.error'))
                                  }
                                })
                              }}
                            >
                              <option value="">{t('order.ownOrder')}</option>
                              {staff.filter((u) => u.id !== member.id && u.isActive).map((u) => (
                                <option key={u.id} value={u.id}>{u.name} · …{u.phone.slice(-4)}</option>
                              ))}
                            </select>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
