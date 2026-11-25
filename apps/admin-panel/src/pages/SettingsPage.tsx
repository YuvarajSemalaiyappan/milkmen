import { useEffect, useState } from 'react'
import { Card, Input, Button } from '@/components/ui'
import { useAuthStore, useAppStore } from '@/store'
import { authApi, subscriptionsApi } from '@/services'
import { PLANS, pricesFrom } from '@/plans'

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const addToast = useAppStore((state) => state.addToast)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Plan prices as text while editing; loaded from the server
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [pricingLoaded, setPricingLoaded] = useState(false)
  const [pricingSaving, setPricingSaving] = useState(false)

  useEffect(() => {
    subscriptionsApi.getPricing()
      .then((res) => {
        const loaded = pricesFrom(res.data)
        setPrices(Object.fromEntries(PLANS.map((p) => [p.value, String(loaded[p.value])])))
        setPricingLoaded(true)
      })
      .catch((error) => addToast({ type: 'error', message: errorText(error, 'Failed to load pricing') }))
  }, [addToast])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)

    try {
      const res = await authApi.updateProfile({ name, email })
      updateUser({ name: res.data.name, email: res.data.email })
      addToast({ type: 'success', message: 'Profile updated successfully' })
    } catch (error) {
      addToast({ type: 'error', message: errorText(error, 'Failed to update profile') })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 8) {
      addToast({ type: 'error', message: 'Password must be at least 8 characters' })
      return
    }

    setPasswordSaving(true)

    try {
      await authApi.changePassword(currentPassword, newPassword)
      addToast({ type: 'success', message: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      addToast({ type: 'error', message: errorText(error, 'Failed to change password') })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault()
    const rows = PLANS.map((p) => ({ plan: p.value, amount: Number(prices[p.value]) }))
    if (rows.some((r) => !Number.isFinite(r.amount) || r.amount < 0 || prices[r.plan] === '')) {
      addToast({ type: 'error', message: 'Enter a price of 0 or more for every plan' })
      return
    }
    setPricingSaving(true)
    try {
      await subscriptionsApi.updatePricing(rows)
      addToast({ type: 'success', message: 'Prices saved' })
    } catch (error) {
      addToast({ type: 'error', message: errorText(error, 'Failed to save prices') })
    } finally {
      setPricingSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" isLoading={profileSaving}>
            Save Changes
          </Button>
        </form>
      </Card>

      {/* Password Settings */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" isLoading={passwordSaving}>
            Change Password
          </Button>
        </form>
      </Card>

      {/* Pricing Settings */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Subscription Pricing</h3>
        <p className="text-sm text-gray-500 mb-4">
          Filled in as the amount when you activate or extend a plan. Businesses see these prices on their Subscription screen.
        </p>
        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {PLANS.map((p) => (
              <Input
                key={p.value}
                label={`${p.label} (${p.days} days), ₹`}
                type="number"
                min={0}
                value={prices[p.value] ?? ''}
                onChange={(e) => setPrices((cur) => ({ ...cur, [p.value]: e.target.value }))}
                disabled={!pricingLoaded}
                required
              />
            ))}
          </div>
          <Button type="submit" isLoading={pricingSaving} disabled={!pricingLoaded}>
            Save Prices
          </Button>
        </form>
      </Card>
    </div>
  )
}
