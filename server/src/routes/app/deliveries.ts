import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import { Prisma } from '@prisma/client'
import { DuplicateEntryError, duplicateResponse, lockEntrySlot } from '../../lib/duplicates.js'
import { lockOwnedRow, NotFoundError, wantsTotal } from '../../lib/db.js'

const router = Router()

// Columns read back by lockOwnedRow (raw query: decimals arrive as Prisma.Decimal)
interface DeliveryRow {
  id: string
  customerId: string
  quantity: Prisma.Decimal
  ratePerLiter: Prisma.Decimal
  totalAmount: Prisma.Decimal
  status: 'DELIVERED' | 'SKIPPED' | 'CANCELLED'
  notes: string | null
  rateEditedAt: Date | null
}

// Balance change when a delivery moves from one state to another
function balanceChange(wasDelivered: boolean, isDelivered: boolean, oldTotal: number, newTotal: number) {
  if (wasDelivered && !isDelivered) return -oldTotal
  if (!wasDelivered && isDelivered) return newTotal
  if (wasDelivered && isDelivered) return newTotal - oldTotal
  return 0
}

// Validation schemas
const createDeliverySchema = z.object({
  customerId: z.string(),
  date: z.string(), // ISO date string
  shift: z.enum(['MORNING', 'EVENING']),
  quantity: z.number().positive(),
  ratePerLiter: z.number().positive(),
  isSubscription: z.boolean().optional(),
  status: z.enum(['DELIVERED', 'SKIPPED', 'CANCELLED']).optional(),
  notes: z.string().max(500).optional(),
  // Set only after the user confirms they really want a second entry for this shift
  allowDuplicate: z.boolean().optional()
})

const updateDeliverySchema = z.object({
  quantity: z.number().positive().optional(),
  ratePerLiter: z.number().positive().optional(),
  status: z.enum(['DELIVERED', 'SKIPPED', 'CANCELLED']).optional(),
  notes: z.string().max(500).optional().nullable()
})

const bulkUpdateSchema = z.object({
  deliveries: z.array(z.object({
    id: z.string(),
    status: z.enum(['DELIVERED', 'SKIPPED', 'CANCELLED']),
    quantity: z.number().positive().optional(),
    notes: z.string().optional()
  }))
})

// GET /api/deliveries - List deliveries with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date, customerId, shift, status, from, to, routeId, order, page: pageStr, limit: limitStr } = req.query

    const page = Math.max(1, parseInt(pageStr as string) || 1)
    // A single day is naturally bounded (a busy business has ~300 entries a day), so a date
    // filter returns the whole day; otherwise lists are paged.
    const maxLimit = typeof date === 'string' && date ? 2000 : 500
    const limit = Math.min(maxLimit, Math.max(1, parseInt(limitStr as string) || (maxLimit === 2000 ? 2000 : 200)))
    const skip = (page - 1) * limit

    const where: Prisma.DeliveryWhereInput = { businessId }

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

    if (customerId && typeof customerId === 'string') {
      where.customerId = customerId
    }

    if (shift && (shift === 'MORNING' || shift === 'EVENING')) {
      where.shift = shift
    }

    if (status && typeof status === 'string') {
      where.status = status as 'DELIVERED' | 'SKIPPED' | 'CANCELLED'
    }

    // Filter by route - get customers in that route
    if (routeId && typeof routeId === 'string') {
      where.customer = {
        routes: {
          some: { routeId }
        }
      }
    }

    // order=asc gives the oldest first (e.g. limit=1 to find a customer's first delivery)
    const orderBy: Prisma.DeliveryOrderByWithRelationInput[] =
      order === 'asc'
        ? [{ date: 'asc' }, { shift: 'asc' }, { createdAt: 'asc' }]
        : [{ date: 'desc' }, { createdAt: 'desc' }]

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, address: true }
          },
          user: {
            select: { id: true, name: true }
          }
        }
      }),
      wantsTotal(pageStr) ? prisma.delivery.count({ where }) : undefined
    ])

    return res.json({
      success: true,
      data: deliveries,
      ...(total !== undefined ? { total, page, limit } : {})
    })
  } catch (error) {
    console.error('List deliveries error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch deliveries'
    })
  }
})

// GET /api/deliveries/today - Get today's deliveries summary
router.get('/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { shift } = req.query

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const where: Prisma.DeliveryWhereInput = {
      businessId,
      date: today
    }

    if (shift && (shift === 'MORNING' || shift === 'EVENING')) {
      where.shift = shift
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, address: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals (only delivered)
    const delivered = deliveries.filter(d => d.status === 'DELIVERED')
    const totals = delivered.reduce(
      (acc, d) => ({
        liters: acc.liters + Number(d.quantity),
        amount: acc.amount + Number(d.totalAmount),
        count: acc.count + 1
      }),
      { liters: 0, amount: 0, count: 0 }
    )

    return res.json({
      success: true,
      data: {
        deliveries,
        totals,
        skipped: deliveries.filter(d => d.status === 'SKIPPED').length,
        cancelled: deliveries.filter(d => d.status === 'CANCELLED').length
      }
    })
  } catch (error) {
    console.error('Get today deliveries error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s deliveries'
    })
  }
})

// GET /api/deliveries/:id - Get a single delivery
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const delivery = await prisma.delivery.findFirst({
      where: { id, businessId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, address: true, defaultRate: true, balance: true, isActive: true }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    })

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      })
    }

    return res.json({
      success: true,
      data: delivery
    })
  } catch (error) {
    console.error('Get delivery error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery'
    })
  }
})

// POST /api/deliveries - Create a new delivery
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const validation = createDeliverySchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { customerId, date, shift, quantity, ratePerLiter, isSubscription, status, notes, allowDuplicate } = validation.data

    const totalAmount = quantity * ratePerLiter
    const deliveryStatus = status || 'DELIVERED'

    // Create delivery and update customer balance in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // One delivery per customer per shift (cancelled ones don't count), unless the user confirmed another one
      await lockEntrySlot(tx, `delivery:${customerId}:${date}:${shift}`)
      if (!allowDuplicate) {
        const existing = await tx.delivery.findMany({
          where: { businessId, customerId, date: new Date(date), shift, status: { not: 'CANCELLED' } },
          select: { id: true, quantity: true }
        })
        if (existing.length) throw new DuplicateEntryError(existing)
      }

      // Update customer balance only if delivered (they owe us more). The same statement checks
      // the customer belongs to the business and is active, so no separate lookup is needed.
      const owner = { id: customerId, businessId, isActive: true }
      const found = deliveryStatus === 'DELIVERED'
        ? (await tx.customer.updateMany({ where: owner, data: { balance: { increment: totalAmount } } })).count > 0
        : !!(await tx.customer.findFirst({ where: owner, select: { id: true } }))
      if (!found) throw new NotFoundError('Customer not found or inactive')

      return tx.delivery.create({
        data: {
          businessId,
          customerId,
          deliveredBy: userId,
          date: new Date(date),
          shift,
          quantity,
          ratePerLiter,
          totalAmount,
          originalRate: ratePerLiter,
          isSubscription: isSubscription || false,
          status: deliveryStatus,
          notes
        }
      })
    })

    return res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof DuplicateEntryError) {
      return res.status(409).json(duplicateResponse('delivery', error.existing))
    }
    if (error instanceof NotFoundError) {
      return res.status(400).json({ success: false, error: error.message })
    }
    console.error('Create delivery error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create delivery'
    })
  }
})

// PUT /api/deliveries/:id - Update a delivery
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updateDeliverySchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { quantity, ratePerLiter, status, notes } = validation.data

    // Update delivery and adjust customer balance. The row is read and locked inside the
    // transaction so two edits at once cannot both apply their balance change.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await lockOwnedRow<DeliveryRow>(tx, 'Delivery', id, businessId)
      const newQuantity = quantity ?? Number(existing.quantity)
      const newRate = ratePerLiter ?? Number(existing.ratePerLiter)
      const newTotal = newQuantity * newRate
      const newStatus = status ?? existing.status
      const change = balanceChange(existing.status === 'DELIVERED', newStatus === 'DELIVERED', Number(existing.totalAmount), newTotal)

      const delivery = await tx.delivery.update({
        where: { id },
        data: {
          quantity: newQuantity,
          ratePerLiter: newRate,
          totalAmount: newTotal,
          status: newStatus,
          notes: notes !== undefined ? notes : existing.notes,
          rateEditedAt: ratePerLiter ? new Date() : existing.rateEditedAt
        }
      })

      // Adjust customer balance
      if (change !== 0) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            balance: { increment: change }
          }
        })
      }

      return delivery
    })

    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Delivery not found' })
    }
    console.error('Update delivery error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update delivery'
    })
  }
})

// POST /api/deliveries/bulk-update - Bulk update delivery statuses
router.post('/bulk-update', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const validation = bulkUpdateSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { deliveries } = validation.data
    if (!deliveries.length) {
      return res.json({ success: true, data: { updated: 0, results: [] } })
    }

    // One transaction with a fixed number of queries, however many rows are sent:
    // lock all rows, update them in one statement, then one balance update per customer.
    const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ids = deliveries.map((d) => d.id)
      const rows = await tx.$queryRaw<DeliveryRow[]>`
        SELECT id, "customerId", quantity, "ratePerLiter", "totalAmount", status, notes, "rateEditedAt"
        FROM "Delivery" WHERE id = ANY(${ids}) AND "businessId" = ${businessId} FOR UPDATE`
      const byId = new Map(rows.map((r) => [r.id, r]))

      const changes: { id: string; status: string; quantity: number; total: number; notes: string | null }[] = []
      const perCustomer = new Map<string, number>()
      for (const update of deliveries) {
        const existing = byId.get(update.id)
        if (!existing) continue
        const newQuantity = update.quantity ?? Number(existing.quantity)
        const newTotal = newQuantity * Number(existing.ratePerLiter)
        const wasDelivered = existing.status === 'DELIVERED'
        const isNowDelivered = update.status === 'DELIVERED'
        // Same rule as before: when it stays delivered, only a new quantity changes the balance
        const change = wasDelivered && isNowDelivered && !update.quantity
          ? 0
          : balanceChange(wasDelivered, isNowDelivered, Number(existing.totalAmount), newTotal)
        if (change !== 0) perCustomer.set(existing.customerId, (perCustomer.get(existing.customerId) ?? 0) + change)
        changes.push({ id: update.id, status: update.status, quantity: newQuantity, total: newTotal, notes: update.notes ?? existing.notes })
      }

      if (changes.length) {
        await tx.$executeRaw`
          UPDATE "Delivery" AS d SET
            status = v.status::"DeliveryStatus",
            quantity = v.quantity,
            "totalAmount" = v.total,
            notes = v.notes,
            "updatedAt" = NOW()
          FROM unnest(
            ${changes.map((c) => c.id)}::text[],
            ${changes.map((c) => c.status)}::text[],
            ${changes.map((c) => c.quantity)}::numeric[],
            ${changes.map((c) => c.total)}::numeric[],
            ${changes.map((c) => c.notes)}::text[]
          ) AS v(id, status, quantity, total, notes)
          WHERE d.id = v.id`
      }
      for (const [customerId, change] of perCustomer) {
        await tx.customer.update({ where: { id: customerId }, data: { balance: { increment: change } } })
      }
      return changes.map((c) => ({ id: c.id, status: 'updated' }))
    })

    return res.json({
      success: true,
      data: { updated: results.length, results }
    })
  } catch (error) {
    console.error('Bulk update deliveries error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk update deliveries'
    })
  }
})

// DELETE /api/deliveries/:id - Delete a delivery
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    // Delete and adjust customer balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await lockOwnedRow<DeliveryRow>(tx, 'Delivery', id, businessId)
      await tx.delivery.delete({
        where: { id }
      })

      // Reduce customer balance only if was delivered
      if (existing.status === 'DELIVERED') {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            balance: { decrement: Number(existing.totalAmount) }
          }
        })
      }
    })

    return res.json({
      success: true,
      message: 'Delivery deleted successfully'
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Delivery not found' })
    }
    console.error('Delete delivery error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete delivery'
    })
  }
})

export default router
