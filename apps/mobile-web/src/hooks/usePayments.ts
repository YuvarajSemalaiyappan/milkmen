import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateLocalId, now } from '@/db/localDb'
import { syncService } from '@/services/syncService'
import { useAppStore } from '@/store'
import type { LocalPayment, PaymentType, PaymentMethod } from '@/types'

export function usePayments() {
  const addToast = useAppStore((state) => state.addToast)

  // Live query from IndexedDB
  const payments = useLiveQuery(
    () => db.payments.orderBy('updatedAt').reverse().toArray(),
    []
  )

  // Get payments by date range
  const getPaymentsByDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      return db.payments
        .filter((p) => p.data.date >= startDate && p.data.date <= endDate)
        .toArray()
    },
    []
  )

  // Get payments by farmer
  const getPaymentsByFarmer = useCallback(async (farmerId: string) => {
    return db.payments
      .filter((p) => p.data.farmerId === farmerId)
      .reverse()
      .sortBy('updatedAt')
  }, [])

  // Get payments by customer
  const getPaymentsByCustomer = useCallback(async (customerId: string) => {
    return db.payments
      .filter((p) => p.data.customerId === customerId)
      .reverse()
      .sortBy('updatedAt')
  }, [])

  // Add new payment
  const addPayment = useCallback(
    async (data: {
      farmerId?: string
      customerId?: string
      date: string
      amount: number
      type: PaymentType
      method: PaymentMethod
      notes?: string
    }) => {
      const localId = generateLocalId()
      const timestamp = now()

      const payment: LocalPayment = {
        id: localId,
        localId,
        syncStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        data: {
          farmerId: data.farmerId,
          customerId: data.customerId,
          date: data.date,
          amount: data.amount,
          type: data.type,
          method: data.method,
          notes: data.notes
        }
      }

      await db.payments.add(payment)

      // Update balance on farmer or customer
      if (data.farmerId) {
        const farmer = await db.farmers.get(data.farmerId)
        if (farmer) {
          const balanceChange =
            data.type === 'PAID_TO_FARMER' ? -data.amount : data.amount
          await db.farmers.update(data.farmerId, {
            'data.balance': farmer.data.balance + balanceChange,
            updatedAt: timestamp
          })
        }
      }

      if (data.customerId) {
        const customer = await db.customers.get(data.customerId)
        if (customer) {
          const balanceChange =
            data.type === 'RECEIVED_FROM_CUSTOMER' ? -data.amount : data.amount
          await db.customers.update(data.customerId, {
            'data.balance': customer.data.balance + balanceChange,
            updatedAt: timestamp
          })
        }
      }

      // Queue for sync
      await syncService.queueSync('payments', localId, 'create', {
        ...data,
        localId
      })

      addToast({ type: 'success', message: 'Payment recorded' })
      return payment
    },
    [addToast]
  )

  // Update payment
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
      const payment = await db.payments.get(id)
      if (!payment) throw new Error('Payment not found')

      const timestamp = now()
      const updatedPayment: LocalPayment = {
        ...payment,
        syncStatus: 'PENDING',
        updatedAt: timestamp,
        data: { ...payment.data, ...updates }
      }

      await db.payments.put(updatedPayment)

      // Queue for sync
      await syncService.queueSync('payments', payment.localId, 'update', {
        id: payment.id,
        ...updates
      })

      addToast({ type: 'success', message: 'Payment updated' })
      return updatedPayment
    },
    [addToast]
  )

  // Delete payment
  const deletePayment = useCallback(
    async (id: string) => {
      const payment = await db.payments.get(id)
      if (!payment) throw new Error('Payment not found')

      // Reverse balance changes
      const timestamp = now()
      if (payment.data.farmerId) {
        const farmer = await db.farmers.get(payment.data.farmerId)
        if (farmer) {
          const balanceChange =
            payment.data.type === 'PAID_TO_FARMER'
              ? payment.data.amount
              : -payment.data.amount
          await db.farmers.update(payment.data.farmerId, {
            'data.balance': farmer.data.balance + balanceChange,
            updatedAt: timestamp
          })
        }
      }

      if (payment.data.customerId) {
        const customer = await db.customers.get(payment.data.customerId)
        if (customer) {
          const balanceChange =
            payment.data.type === 'RECEIVED_FROM_CUSTOMER'
              ? payment.data.amount
              : -payment.data.amount
          await db.customers.update(payment.data.customerId, {
            'data.balance': customer.data.balance + balanceChange,
            updatedAt: timestamp
          })
        }
      }

      await db.payments.delete(id)

      // Queue for sync
      await syncService.queueSync('payments', payment.localId, 'delete', {
        id: payment.id
      })

      addToast({ type: 'success', message: 'Payment deleted' })
    },
    [addToast]
  )

  // Get payment by ID
  const getPayment = useCallback(async (id: string) => {
    return db.payments.get(id)
  }, [])

  // Get today's payments
  const getTodayPayments = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    return db.payments.filter((p) => p.data.date === today).toArray()
  }, [])

  // Get farmer payments summary
  const getFarmerPaymentsSummary = useCallback(
    async (farmerId: string, startDate?: string, endDate?: string) => {
      let payments = await db.payments
        .filter((p) => p.data.farmerId === farmerId)
        .toArray()

      if (startDate && endDate) {
        payments = payments.filter(
          (p) => p.data.date >= startDate && p.data.date <= endDate
        )
      }

      const totalPaid = payments
        .filter((p) => p.data.type === 'PAID_TO_FARMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      const totalAdvance = payments
        .filter((p) => p.data.type === 'ADVANCE_TO_FARMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      return {
        totalPaid,
        totalAdvance,
        totalPayments: totalPaid + totalAdvance,
        paymentCount: payments.length
      }
    },
    []
  )

  // Get customer payments summary
  const getCustomerPaymentsSummary = useCallback(
    async (customerId: string, startDate?: string, endDate?: string) => {
      let payments = await db.payments
        .filter((p) => p.data.customerId === customerId)
        .toArray()

      if (startDate && endDate) {
        payments = payments.filter(
          (p) => p.data.date >= startDate && p.data.date <= endDate
        )
      }

      const totalReceived = payments
        .filter((p) => p.data.type === 'RECEIVED_FROM_CUSTOMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      const totalAdvance = payments
        .filter((p) => p.data.type === 'ADVANCE_FROM_CUSTOMER')
        .reduce((sum, p) => sum + Number(p.data.amount), 0)

      return {
        totalReceived,
        totalAdvance,
        totalPayments: totalReceived + totalAdvance,
        paymentCount: payments.length
      }
    },
    []
  )

  const stablePayments = useMemo(() => payments ?? [], [payments])

  return {
    payments: stablePayments,
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
    isLoading: payments === undefined
  }
}

export default usePayments
