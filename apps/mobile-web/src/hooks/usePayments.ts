import { useState, useEffect, useCallback } from 'react'
import { paymentsApi } from '@/services/api'
import { useAppStore } from '@/store'
import type { Payment, PaymentType, PaymentMethod, ApiResponse } from '@/types'

export function usePayments() {
  const addToast = useAppStore((state) => state.addToast)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await paymentsApi.list() as ApiResponse<Payment[]>
      if (response.success && response.data) {
        setPayments(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const getPaymentsByDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      return payments.filter((p) => p.date >= startDate && p.date <= endDate)
    },
    [payments]
  )

  const getPaymentsByFarmer = useCallback(async (farmerId: string) => {
    try {
      const response = await paymentsApi.list({ farmerId }) as ApiResponse<Payment[]>
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to fetch payments by farmer:', error)
      return []
    }
  }, [])

  const getPaymentsByCustomer = useCallback(async (customerId: string) => {
    try {
      const response = await paymentsApi.list({ customerId }) as ApiResponse<Payment[]>
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to fetch payments by customer:', error)
      return []
    }
  }, [])

  const addPayment = useCallback(
    async (data: {
      farmerId?: string
      customerId?: string
      date: string
      amount: number
      type: PaymentType
      method: PaymentMethod
      notes?: string
      periodFromDate?: string
      periodToDate?: string
      periodFromShift?: string
      periodToShift?: string
    }) => {
      try {
        const response = await paymentsApi.create(data) as ApiResponse<Payment>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Payment recorded' })
          await fetchPayments()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add payment'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchPayments]
  )

  const updatePayment = useCallback(
    async (
      id: string,
      updates: Partial<{
        date: string
        amount: number
        type: PaymentType
        method: PaymentMethod
        notes?: string
      }>
    ) => {
      try {
        const response = await paymentsApi.update(id, updates) as ApiResponse<Payment>
        if (response.success && response.data) {
          addToast({ type: 'success', message: 'Payment updated' })
          await fetchPayments()
          return response.data
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update payment'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchPayments]
  )

  const deletePayment = useCallback(
    async (id: string) => {
      try {
        const response = await paymentsApi.delete(id) as ApiResponse<void>
        if (response.success) {
          addToast({ type: 'success', message: 'Payment deleted' })
          await fetchPayments()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete payment'
        addToast({ type: 'error', message })
        throw error
      }
    },
    [addToast, fetchPayments]
  )

  const getPayment = useCallback(async (id: string) => {
    try {
      const response = await paymentsApi.get(id) as ApiResponse<Payment>
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to fetch payment:', error)
      return null
    }
  }, [])

  const getTodayPayments = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const response = await paymentsApi.list({ date: today }) as ApiResponse<Payment[]>
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to fetch today payments:', error)
      return []
    }
  }, [])

  const getFarmerPaymentsSummary = useCallback(
    async (farmerId: string, startDate?: string, endDate?: string) => {
      const farmerPayments = await getPaymentsByFarmer(farmerId)
      let filtered = farmerPayments
      if (startDate && endDate) {
        filtered = farmerPayments.filter(
          (p) => p.date >= startDate && p.date <= endDate
        )
      }
      const totalPaid = filtered
        .filter((p) => p.type === 'PAID_TO_FARMER')
        .reduce((sum, p) => sum + Number(p.amount), 0)
      const totalAdvance = filtered
        .filter((p) => p.type === 'ADVANCE_TO_FARMER')
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return {
        totalPaid,
        totalAdvance,
        totalPayments: totalPaid + totalAdvance,
        paymentCount: filtered.length
      }
    },
    [getPaymentsByFarmer]
  )

  const getCustomerPaymentsSummary = useCallback(
    async (customerId: string, startDate?: string, endDate?: string) => {
      const customerPayments = await getPaymentsByCustomer(customerId)
      let filtered = customerPayments
      if (startDate && endDate) {
        filtered = customerPayments.filter(
          (p) => p.date >= startDate && p.date <= endDate
        )
      }
      const totalReceived = filtered
        .filter((p) => p.type === 'RECEIVED_FROM_CUSTOMER')
        .reduce((sum, p) => sum + Number(p.amount), 0)
      const totalAdvance = filtered
        .filter((p) => p.type === 'ADVANCE_FROM_CUSTOMER')
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return {
        totalReceived,
        totalAdvance,
        totalPayments: totalReceived + totalAdvance,
        paymentCount: filtered.length
      }
    },
    [getPaymentsByCustomer]
  )

  return {
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    getPayment,
    getPaymentsByDateRange,
    getPaymentsByFarmer,
    getPaymentsByCustomer,
    getTodayPayments,
    getFarmerPaymentsSummary,
    getCustomerPaymentsSummary,
    fetchPayments,
    isLoading
  }
}

export default usePayments
