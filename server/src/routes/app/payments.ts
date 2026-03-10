import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import type { Prisma } from '@prisma/client'

const router = Router()

// Validation schemas
const createPaymentSchema = z.object({
  localId: z.string().optional(),
  farmerId: z.string().optional(),
  customerId: z.string().optional(),
  date: z.string(), // ISO date string
  amount: z.number().positive(),
  type: z.enum(['PAID_TO_FARMER', 'RECEIVED_FROM_CUSTOMER', 'ADVANCE_TO_FARMER', 'ADVANCE_FROM_CUSTOMER']),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional(),
  notes: z.string().max(500).optional(),
  periodFromDate: z.string().optional(),
  periodToDate: z.string().optional(),
  periodFromShift: z.enum(['MORNING', 'EVENING']).optional(),
  periodToShift: z.enum(['MORNING', 'EVENING']).optional()
}).refine(
  (data) => data.farmerId || data.customerId,
  { message: 'Either farmerId or customerId is required' }
).refine(
  (data) => !(data.farmerId && data.customerId),
  { message: 'Cannot specify both farmerId and customerId' }
).refine(
  (data) => {
    // If any period field is set, all must be set
    const periodFields = [data.periodFromDate, data.periodToDate, data.periodFromShift, data.periodToShift]
    const defined = periodFields.filter(f => f !== undefined)
    return defined.length === 0 || defined.length === 4
  },
  { message: 'All period fields must be provided together (periodFromDate, periodToDate, periodFromShift, periodToShift)' }
).refine(
  (data) => {
    if (!data.periodFromDate || !data.periodToDate) return true
    return data.periodFromDate <= data.periodToDate
  },
  { message: 'periodFromDate must be on or before periodToDate' }
)

// GET /api/payments - List payments with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date, farmerId, customerId, type, from, to } = req.query

    const where: Prisma.PaymentWhereInput = { businessId }

    if (date && typeof date === 'string') {
      where.date = new Date(date)
    } else if (from || to) {
      where.date = {}
      if (from && typeof from === 'string') {
        where.date.gte = new Date(from)
      }
      if (to && typeof to === 'string') {
        where.date.lte = new Date(to)
      }
    }

    if (farmerId && typeof farmerId === 'string') {
      where.farmerId = farmerId
    }

    if (customerId && typeof customerId === 'string') {
      where.customerId = customerId
    }

    if (type && typeof type === 'string') {
      where.type = type as 'PAID_TO_FARMER' | 'RECEIVED_FROM_CUSTOMER' | 'ADVANCE_TO_FARMER' | 'ADVANCE_FROM_CUSTOMER'
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        farmer: {
          select: { id: true, name: true, phone: true }
        },
        customer: {
          select: { id: true, name: true, phone: true }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    })

    return res.json({
      success: true,
      data: payments
    })
  } catch (error) {
    console.error('List payments error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    })
  }
})

// GET /api/payments/today - Get today's payments summary
router.get('/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        date: today
      },
      include: {
        farmer: {
          select: { id: true, name: true }
        },
        customer: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals by type
    const totals = {
      paidToFarmers: 0,
      receivedFromCustomers: 0,
      advanceToFarmers: 0,
      advanceFromCustomers: 0
    }

    payments.forEach(p => {
      const amount = Number(p.amount)
      switch (p.type) {
        case 'PAID_TO_FARMER':
          totals.paidToFarmers += amount
          break
        case 'RECEIVED_FROM_CUSTOMER':
          totals.receivedFromCustomers += amount
          break
        case 'ADVANCE_TO_FARMER':
          totals.advanceToFarmers += amount
          break
        case 'ADVANCE_FROM_CUSTOMER':
          totals.advanceFromCustomers += amount
          break
      }
    })

    return res.json({
      success: true,
      data: {
        payments,
        totals,
        count: payments.length
      }
    })
  } catch (error) {
    console.error('Get today payments error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s payments'
    })
  }
})

// GET /api/payments/:id - Get a single payment
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const payment = await prisma.payment.findFirst({
      where: { id, businessId },
      include: {
        farmer: true,
        customer: true,
        user: {
          select: { id: true, name: true }
        }
      }
    })

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      })
    }

    return res.json({
      success: true,
      data: payment
    })
  } catch (error) {
    console.error('Get payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    })
  }
})

// POST /api/payments - Create a new payment
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const validation = createPaymentSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { localId, farmerId, customerId, date, amount, type, method, notes, periodFromDate, periodToDate, periodFromShift, periodToShift } = validation.data

    // Verify farmer/customer belongs to business
    if (farmerId) {
      const farmer = await prisma.farmer.findFirst({
        where: { id: farmerId, businessId }
      })
      if (!farmer) {
        return res.status(400).json({
          success: false,
          error: 'Farmer not found'
        })
      }
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId }
      })
      if (!customer) {
        return res.status(400).json({
          success: false,
          error: 'Customer not found'
        })
      }
    }

    // Check for duplicate localId
    if (localId) {
      const existing = await prisma.payment.findUnique({
        where: { localId }
      })
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          message: 'Payment already synced'
        })
      }
    }

    // Create payment and update balance in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payment = await tx.payment.create({
        data: {
          localId,
          businessId,
          farmerId,
          customerId,
          recordedBy: userId,
          date: new Date(date),
          amount,
          type,
          method: method || 'CASH',
          notes,
          periodFromDate: periodFromDate ? new Date(periodFromDate) : undefined,
          periodToDate: periodToDate ? new Date(periodToDate) : undefined,
          periodFromShift: periodFromShift || undefined,
          periodToShift: periodToShift || undefined,
          syncStatus: 'SYNCED'
        },
        include: {
          farmer: farmerId ? {
            select: { id: true, name: true }
          } : false,
          customer: customerId ? {
            select: { id: true, name: true }
          } : false
        }
      })

      // Update balance: all payment types (regular + advance) reduce balance
      if (farmerId) {
        await tx.farmer.update({
          where: { id: farmerId },
          data: { balance: { decrement: amount } }
        })
      }

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: amount } }
        })
      }

      return payment
    })

    return res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Create payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    })
  }
})

// DELETE /api/payments/:id - Delete a payment (and reverse balance)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.payment.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      })
    }

    // Delete and reverse balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payment.delete({
        where: { id }
      })

      const amount = Number(existing.amount)

      // Reverse the balance change
      if (existing.farmerId) {
        // Reverse: add back what was subtracted
        await tx.farmer.update({
          where: { id: existing.farmerId },
          data: {
            balance: { increment: amount }
          }
        })
      }

      if (existing.customerId) {
        // Reverse: add back what was subtracted
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            balance: { increment: amount }
          }
        })
      }
    })

    return res.json({
      success: true,
      message: 'Payment deleted successfully'
    })
  } catch (error) {
    console.error('Delete payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete payment'
    })
  }
})

export default router
