import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Edit2,
  Trash2,
  MapPin,
  UserPlus,
  ChevronRight,
  Phone
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { useAreas } from '@/hooks'
import { useAuthStore } from '@/store'
import { routesApi } from '@/services/api'
import type { ApiResponse } from '@/types'

const areaSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100)
})

type AreaFormData = z.infer<typeof areaSchema>

interface RouteFarmerItem {
  id: string
  farmerId: string
  areaId?: string | null
  farmer: {
    id: string
    name: string
    phone?: string
    village?: string
  }
}

interface RouteCustomerItem {
  id: string
  customerId: string
  areaId?: string | null
  customer: {
    id: string
    name: string
    phone?: string
    address?: string
  }
}

interface RouteDetailData {
  id: string
  routeFarmers: RouteFarmerItem[]
  routeCustomers: RouteCustomerItem[]
}

export function AreaDetailPage() {
  const { t } = useTranslation()
  const { routeId, areaId } = useParams<{ routeId: string; areaId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { areas, updateArea, deleteArea } = useAreas(routeId)

  const isManager = user?.role === 'MANAGER' || user?.role === 'OWNER'

  const area = areas.find((a) => a.id === areaId)
  const [assignedFarmers, setAssignedFarmers] = useState<RouteFarmerItem[]>([])
  const [assignedCustomers, setAssignedCustomers] = useState<RouteCustomerItem[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema)
  })

  const loadMembers = useCallback(async () => {
    if (!routeId) return
    try {
      const response = await routesApi.get(routeId) as ApiResponse<RouteDetailData>
      if (response.success && response.data) {
        setAssignedFarmers(
          response.data.routeFarmers.filter((rf) => rf.areaId === areaId)
        )
        setAssignedCustomers(
          response.data.routeCustomers.filter((rc) => rc.areaId === areaId)
        )
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    }
  }, [routeId, areaId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useEffect(() => {
    if (area) {
      reset({ name: area.name })
    }
  }, [area, reset])

  const onSubmit = async (data: AreaFormData) => {
    if (!areaId) return
    try {
      setIsSubmitting(true)
      await updateArea(areaId, { name: data.name })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update area:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!areaId) return
    try {
      setIsDeleting(true)
      await deleteArea(areaId)
      navigate(`/routes/${routeId}/areas`)
    } catch (error) {
      console.error('Failed to delete area:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!area) {
    return (
      <AppShell title={t('areas.title')} showBack>
        <div className="p-4 text-center text-gray-500">
          {t('common.loading')}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={isEditing ? t('areas.edit') : area.name}
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
                label={t('areas.name')}
                error={errors.name?.message}
                {...register('name')}
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
            {/* Area Info */}
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                <h2 className="text-xl font-semibold">{area.name}</h2>
              </div>
              <p className="text-sm text-gray-500">
                {area._count.routeFarmers} {t('areas.assignedFarmers').toLowerCase()}, {area._count.routeCustomers} {t('areas.assignedCustomers').toLowerCase()}
              </p>
            </Card>

            {/* Assigned Farmers */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {t('areas.assignedFarmers')} ({assignedFarmers.length})
                </h3>
                {isManager && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/routes/${routeId}/areas/${areaId}/assign-farmers`)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    {t('areas.assignFarmers')}
                  </Button>
                )}
              </div>
              {assignedFarmers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  {t('areas.noFarmersAssigned')}
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedFarmers.map((rf) => (
                    <div
                      key={rf.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700 cursor-pointer"
                      onClick={() => navigate(`/farmers/${rf.farmer.id}`)}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{rf.farmer.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {rf.farmer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {rf.farmer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Assigned Customers */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {t('areas.assignedCustomers')} ({assignedCustomers.length})
                </h3>
                {isManager && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/routes/${routeId}/areas/${areaId}/assign-customers`)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    {t('areas.assignCustomers')}
                  </Button>
                )}
              </div>
              {assignedCustomers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">
                  {t('areas.noCustomersAssigned')}
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedCustomers.map((rc) => (
                    <div
                      key={rc.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700 cursor-pointer"
                      onClick={() => navigate(`/customers/${rc.customer.id}`)}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{rc.customer.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {rc.customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {rc.customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
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
                      {t('areas.confirmDelete')}
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
                    {t('areas.deleteArea')}
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
