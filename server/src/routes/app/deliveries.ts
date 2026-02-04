import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import type { Prisma } from '@prisma/client'

const router = Router()

// Validation schemas
const createDeliverySchema = z.object({
  localId: z.string().optional(),
  customerId: z.string(),
  date: z.string(), // ISO date string
  shift: z.enum(['MORNING', 'EVENING']),
  quantity: z.number().positive(),
  ratePerLiter: z.number().positive(),
  isSubscription: z.boolean().optional(),
  status: z.enum(['DELIVERED', 'SKIPPED', 'CANCELLED']).optional(),
  notes: z.string().max(500).optional()
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
    const { date, customerId, shift, status, from, to, routeId } = req.query

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

    const deliveries = await prisma.delivery.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: {
          select: { id: true, name: true, phone: true, address: true }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    })

    return res.json({
      success: true,
      data: deliveries
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
        customer: true,
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

    const { localId, customerId, date, shift, quantity, ratePerLiter, isSubscription, status, notes } = validation.data

    // Verify customer belongs to business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, isActive: true }
    })

    if (!customer) {
      return res.status(400).json({
        success: false,
        error: 'Customer not found or inactive'
      })
    }

    // Check for duplicate localId
    if (localId) {
      const existing = await prisma.delivery.findUnique({
        where: { localId }
      })
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          message: 'Delivery already synced'
        })
      }
    }

    const totalAmount = quantity * ratePerLiter
    const deliveryStatus = status || 'DELIVERED'

    // Create delivery and update customer balance in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const delivery = await tx.delivery.create({
        data: {
          localId,
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
          notes,
          syncStatus: 'SYNCED'
        },
        include: {
          customer: {
            select: { id: true, name: true }
          }
        }
      })

      // Update customer balance only if delivered (they owe us more)
      if (deliveryStatus === 'DELIVERED') {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: { increment: totalAmount }
          }
        })
      }

      return delivery
    })

    return res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
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

    const existing = await prisma.delivery.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      })
    }

    const { quantity, ratePerLiter, status, notes } = validation.data
    const newQuantity = quantity ?? Number(existing.quantity)
    const newRate = ratePerLiter ?? Number(existing.ratePerLiter)
    const newTotal = newQuantity * newRate
    const newStatus = status ?? existing.status

    // Calculate balance adjustments
    const wasDelivered = existing.status === 'DELIVERED'
    const isNowDelivered = newStatus === 'DELIVERED'
    const oldTotal = Number(existing.totalAmount)

    let balanceChange = 0
    if (wasDelivered && !isNowDelivered) {
      // Was delivered, now cancelled/skipped - remove from balance
      balanceChange = -oldTotal
    } else if (!wasDelivered && isNowDelivered) {
      // Wasn't delivered, now is - add to balance
      balanceChange = newTotal
    } else if (wasDelivered && isNowDelivered) {
      // Still delivered - adjust for amount change
      balanceChange = newTotal - oldTotal
    }

    // Update delivery and adjust customer balance
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const delivery = await tx.delivery.update({
        where: { id },
        data: {
          quantity: newQuantity,
          ratePerLiter: newRate,
          totalAmount: newTotal,
          status: newStatus,
          notes: notes !== undefined ? notes : existing.notes,
          rateEditedAt: ratePerLiter ? new Date() : existing.rateEditedAt,
          syncStatus: 'SYNCED'
        }
      })

      // Adjust customer balance
      if (balanceChange !== 0) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            balance: { increment: balanceChange }
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
    const results = []

    for (const update of deliveries) {
      const existing = await prisma.delivery.findFirst({
        where: { id: update.id, businessId }
      })

      if (!existing) continue

      const newQuantity = update.quantity ?? Number(existing.quantity)
      const newTotal = newQuantity * Number(existing.ratePerLiter)

      // Calculate balance change
      const wasDelivered = existing.status === 'DELIVERED'
      const isNowDelivered = update.status === 'DELIVERED'
      const oldTotal = Number(existing.totalAmount)

      let balanceChange = 0
      if (wasDelivered && !isNowDelivered) {
        balanceChange = -oldTotal
      } else if (!wasDelivered && isNowDelivered) {
        balanceChange = newTotal
      } else if (wasDelivered && isNowDelivered && update.quantity) {
        balanceChange = newTotal - oldTotal
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.delivery.update({
          where: { id: update.id },
          data: {
            status: update.status,
            quantity: newQuantity,
            totalAmount: newTotal,
            notes: update.notes ?? existing.notes
          }
        })

        if (balanceChange !== 0) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: {
              balance: { increment: balanceChange }
            }
          })
        }
      })

      results.push({ id: update.id, status: 'updated' })
    }

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

    const existing = await prisma.delivery.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      })
    }

    // Delete and adjust customer balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    console.error('Delete delivery error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete delivery'
    })
  }
})

export default router
