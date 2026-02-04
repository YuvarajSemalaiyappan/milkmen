import { useState } from 'react'
import { Card, Input, Button } from '@/components/ui'
import { useAuthStore, useAppStore } from '@/store'

export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const addToast = useAppStore((state) => state.addToast)

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // TODO: API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      addToast({ type: 'success', message: 'Profile updated successfully' })
    } catch {
      addToast({ type: 'error', message: 'Failed to update profile' })
    } finally {
      setIsLoading(false)
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

    setIsLoading(true)

    try {
      // TODO: API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      addToast({ type: 'success', message: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      addToast({ type: 'error', message: 'Failed to change password' })
    } finally {
      setIsLoading(false)
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
          <Button type="submit" isLoading={isLoading}>
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
          <Button type="submit" isLoading={isLoading}>
            Change Password
          </Button>
        </form>
      </Card>

      {/* Pricing Settings */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">Monthly</p>
            <p className="text-2xl font-bold text-gray-900">₹299</p>
            <p className="text-xs text-gray-400">30 days</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">Quarterly</p>
            <p className="text-2xl font-bold text-gray-900">₹799</p>
            <p className="text-xs text-gray-400">90 days</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">Half Yearly</p>
            <p className="text-2xl font-bold text-gray-900">₹1,499</p>
            <p className="text-xs text-gray-400">180 days</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">Annual</p>
            <p className="text-2xl font-bold text-gray-900">₹2,499</p>
            <p className="text-xs text-gray-400">365 days</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
