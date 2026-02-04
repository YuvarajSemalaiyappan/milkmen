import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Trash2,
  Users,
  MapPin,
  UserPlus,
  ChevronRight,
  Phone,
  X
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card, Badge } from '@/components/ui'
import { useRoutes } from '@/hooks'
import { useAuthStore } from '@/store'
import { formatCurrency } from '@/utils'

const routeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional()
})

type RouteFormData = z.infer<typeof routeSchema>

interface RouteDetail {
  id: string
  name: string
  description?: string
  isActive: boolean
  userRoutes: Array<{
    id: string
    user: { id: string; name: string; phone: string; role: string; isActive: boolean }
  }>
  routeFarmers: Array<{
    id: string
    sortOrder: number
    farmer: { id: string; name: string; phone?: string; village?: string; defaultRate: number; isActive: boolean; balance: number }
  }>
  routeCustomers: Array<{
    id: string
    sortOrder: number
    customer: { id: string; name: string; phone?: string; address?: string; defaultRate: number; isActive: boolean; balance: number }
  }>
}

export function RouteDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { getRoute, updateRoute, deleteRoute, removeUser, removeFarmer, removeCustomer } = useRoutes()

  const isOwner = user?.role === 'OWNER'
  const isManager = user?.role === 'MANAGER' || user?.role === 'OWNER'

  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema)
  })

  const loadRoute = useCallback(async () => {
    if (!id) return
    const data = await getRoute(id) as RouteDetail | null
    if (data) {
      setRoute(data)
      reset({
        name: data.name,
        description: data.description || ''
      })
    }
  }, [id, getRoute, reset])

  useEffect(() => {
    loadRoute()
  }, [loadRoute])

  const onSubmit = async (data: RouteFormData) => {
    if (!id) return
    try {
      setIsSubmitting(true)
      await updateRoute(id, {
        name: data.name,
        description: data.description || undefined
      })
      setIsEditing(false)
      loadRoute()
    } catch (error) {
      console.error('Failed to update route:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setIsDeleting(true)
      await deleteRoute(id)
      navigate('/routes')
    } catch (error) {
      console.error('Failed to delete route:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRemoveUser = async (userId: string) => {
    if (!id) return
    await removeUser(id, userId)
    loadRoute()
  }

  const handleRemoveFarmer = async (farmerId: string) => {
    if (!id) return
    await removeFarmer(id, farmerId)
    loadRoute()
  }

  const handleRemoveCustomer = async (customerId: string) => {
    if (!id) return
    await removeCustomer(id, customerId)
    loadRoute()
  }

  if (!route) {
    return (
      <AppShell title={t('routes.details')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}...
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={isEditing ? t('routes.edit') : route.name}
      showBack
      rightAction={
        !isEditing && isManager ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit2 className="w-4 h-4" />}
          >
            {t('common.edit')}
          </Button>
        ) : undefined
      }
    >
      <div className="px-4 pt-5 pb-4 space-y-4">
        {isEditing ? (
          <Card>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={t('routes.name')}
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label={t('routes.description')}
                error={errors.description?.message}
                {...register('description')}
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    reset()
                  }}
                  fullWidth
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSubmitting} fullWidth>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <>
            {/* Route Info */}
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                <h2 className="text-xl font-semibold">{route.name}</h2>
              </div>
              {route.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {route.description}
                </p>
              )}
            </Card>

            {/* Assigned Users */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('routes.assignedStaff')} ({route.userRoutes.length})
                </h3>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/routes/${id}/assign-users`)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    {t('routes.assign')}
                  </Button>
                )}
              </div>
              {route.userRoutes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  {t('routes.noStaffAssigned')}
                </p>
              ) : (
                <div className="space-y-2">
                  {route.userRoutes.map((ur) => (
                    <div key={ur.id} className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{ur.user.name}</p>
                        <p className="text-sm text-gray-500">{ur.user.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge size="sm" variant={ur.user.role === 'OWNER' ? 'info' : ur.user.role === 'MANAGER' ? 'success' : 'warning'}>
                          {ur.user.role}
                        </Badge>
                        {isOwner && ur.user.role !== 'OWNER' && (
                          <button
                            onClick={() => handleRemoveUser(ur.user.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Assigned Farmers */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {t('routes.assignedFarmers')} ({route.routeFarmers.length})
                </h3>
                {isManager && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/routes/${id}/assign-farmers`)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    {t('routes.assign')}
                  </Button>
                )}
              </div>
              {route.routeFarmers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  {t('routes.noFarmersAssigned')}
                </p>
              ) : (
                <div className="space-y-2">
                  {route.routeFarmers.map((rf) => (
                    <div
                      key={rf.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/farmers/${rf.farmer.id}`)}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{rf.farmer.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {rf.farmer.village && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {rf.farmer.village}
                            </span>
                          )}
                          <span>{formatCurrency(rf.farmer.defaultRate)}/L</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isManager && (
                          <button
                            onClick={() => handleRemoveFarmer(rf.farmer.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight
                          className="w-4 h-4 text-gray-400 cursor-pointer"
                          onClick={() => navigate(`/farmers/${rf.farmer.id}`)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Assigned Customers */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {t('routes.assignedCustomers')} ({route.routeCustomers.length})
                </h3>
                {isManager && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/routes/${id}/assign-customers`)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    {t('routes.assign')}
                  </Button>
                )}
              </div>
              {route.routeCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  {t('routes.noCustomersAssigned')}
                </p>
              ) : (
                <div className="space-y-2">
                  {route.routeCustomers.map((rc) => (
                    <div
                      key={rc.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/customers/${rc.customer.id}`)}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{rc.customer.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {rc.customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {rc.customer.phone}
                            </span>
                          )}
                          <span>{formatCurrency(rc.customer.defaultRate)}/L</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isManager && (
                          <button
                            onClick={() => handleRemoveCustomer(rc.customer.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight
                          className="w-4 h-4 text-gray-400 cursor-pointer"
                          onClick={() => navigate(`/customers/${rc.customer.id}`)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Delete Button */}
            {isManager && (
              <div className="pt-4">
                {showDeleteConfirm ? (
                  <Card className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                      {t('routes.confirmDelete')}
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                        fullWidth
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={handleDelete}
                        isLoading={isDeleting}
                        fullWidth
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    fullWidth
                  >
                    {t('routes.deleteRoute')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
