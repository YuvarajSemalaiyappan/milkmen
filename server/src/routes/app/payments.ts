import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import { Prisma } from '@prisma/client'
import { lockEntrySlot } from '../../lib/duplicates.js'
import { lockOwnedRow, NotFoundError, wantsTotal } from '../../lib/db.js'

const router = Router()

class OverlapError extends Error {}

// Columns read back by lockOwnedRow (raw query: decimals arrive as Prisma.Decimal)
interface PaymentRow {
  farmerId: string | null
  customerId: string | null
  amount: Prisma.Decimal
}

// Validation schemas
const createPaymentSchema = z.object({
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

const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional(),
  notes: z.string().max(500).optional()
})

// GET /api/payments - List payments with filters and pagination
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date, farmerId, customerId, type, from, to, page: pageStr, limit: limitStr } = req.query

    const page = Math.max(1, parseInt(pageStr as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(limitStr as string) || 50))
    const skip = (page - 1) * limit

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

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
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
      }),
      wantsTotal(pageStr) ? prisma.payment.count({ where }) : undefined
    ])

    return res.json({
      success: true,
      data: payments,
      ...(total !== undefined ? { total, page, limit } : {})
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
    const { date: dateParam } = req.query

    // Use client-provided date or fall back to server date
    let targetDate: Date
    if (dateParam && typeof dateParam === 'string') {
      targetDate = new Date(dateParam + 'T00:00:00.000Z')
    } else {
      targetDate = new Date()
      targetDate.setHours(0, 0, 0, 0)
    }

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        date: targetDate
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
        farmer: {
          select: { id: true, name: true, phone: true, village: true, balance: true, isActive: true }
        },
        customer: {
          select: { id: true, name: true, phone: true, address: true, balance: true, isActive: true }
        },
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

    const { farmerId, customerId, date, amount, type, method, notes, periodFromDate, periodToDate, periodFromShift, periodToShift } = validation.data

    const hasPeriod = !!(periodFromDate && periodToDate && periodFromShift && periodToShift)

    // One transaction, a fixed number of queries. A lock per person makes two saves at the same
    // moment (double tap, two phones) run one after the other, so the overlap check holds.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockEntrySlot(tx, `payment:${farmerId ?? customerId}`)

      if (hasPeriod) {
        // Periods overlap unless one ends before the other starts. Shifts compare in enum order
        // (MORNING < EVENING), so (date, shift) pairs compare like the app's period logic.
        const overlap = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Payment"
          WHERE "businessId" = ${businessId}
            AND ${farmerId ? Prisma.sql`"farmerId" = ${farmerId}` : Prisma.sql`"customerId" = ${customerId}`}
            AND "periodFromDate" IS NOT NULL AND "periodToDate" IS NOT NULL
            AND "periodFromShift" IS NOT NULL AND "periodToShift" IS NOT NULL
            AND ("periodToDate", "periodToShift") >= (${periodFromDate}::date, ${periodFromShift}::"Shift")
            AND ("periodFromDate", "periodFromShift") <= (${periodToDate}::date, ${periodToShift}::"Shift")
          LIMIT 1`
        if (overlap.length) throw new OverlapError()
      }

      // All payment types (regular + advance) reduce the balance. The same statement checks the
      // person belongs to the business, so no separate lookup is needed.
      const updated = farmerId
        ? await tx.farmer.updateMany({ where: { id: farmerId, businessId }, data: { balance: { decrement: amount } } })
        : await tx.customer.updateMany({ where: { id: customerId, businessId }, data: { balance: { decrement: amount } } })
      if (updated.count === 0) throw new NotFoundError(farmerId ? 'Farmer not found' : 'Customer not found')

      return tx.payment.create({
        data: {
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
          periodToShift: periodToShift || undefined
        }
      })
    })

    return res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof OverlapError) {
      return res.status(409).json({ success: false, error: 'A payment already exists for an overlapping period' })
    }
    if (error instanceof NotFoundError) {
      return res.status(400).json({ success: false, error: error.message })
    }
    console.error('Create payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    })
  }
})

// PUT /api/payments/:id - Update a payment
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updatePaymentSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { amount, method, notes } = validation.data

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Read and lock the row inside the transaction so two edits cannot both adjust the balance
      const existing = await lockOwnedRow<PaymentRow>(tx, 'Payment', id, businessId)
      const oldAmount = Number(existing.amount)
      const amountDelta = oldAmount - (amount ?? oldAmount)

      const updateData: Record<string, unknown> = {}
      if (amount !== undefined) updateData.amount = amount
      if (method !== undefined) updateData.method = method
      if (notes !== undefined) updateData.notes = notes

      const payment = await tx.payment.update({
        where: { id },
        data: updateData,
        include: {
          farmer: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } }
        }
      })

      // Adjust balance if amount changed
      if (amountDelta !== 0) {
        if (existing.farmerId) {
          await tx.farmer.update({
            where: { id: existing.farmerId },
            data: { balance: { increment: amountDelta } }
          })
        }
        if (existing.customerId) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { balance: { increment: amountDelta } }
          })
        }
      }

      return payment
    })

    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Payment not found' })
    }
    console.error('Update payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update payment'
    })
  }
})

// DELETE /api/payments/:id - Delete a payment (and reverse balance)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    // Delete and reverse balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await lockOwnedRow<PaymentRow>(tx, 'Payment', id, businessId)
      await tx.payment.delete({
        where: { id }
      })

      const amount = Number(existing.amount)

      // Reverse the balance change
      if (existing.farmerId) {
        await tx.farmer.update({
          where: { id: existing.farmerId },
          data: {
            balance: { increment: amount }
          }
        })
      }

      if (existing.customerId) {
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
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Payment not found' })
    }
    console.error('Delete payment error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete payment'
    })
  }
})

export default router
