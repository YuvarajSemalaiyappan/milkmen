import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import { locationFields, pinAudit, pinIsComplete, pinMessage } from '../../lib/location.js'
import { addOrderFollowRoutes, assertOwnOrder, FollowingOrderError, orderOwner } from '../../lib/order-follow.js'

const router = Router()

// Validation schemas
const createFarmerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\d+$/, 'Phone must contain only digits').max(15).optional(),
  village: z.string().max(100).optional(),
  defaultRate: z.number().positive(),
  collectAM: z.boolean().optional(),
  collectPM: z.boolean().optional(),
  subscriptionQtyAM: z.number().nonnegative().optional().nullable(),
  subscriptionQtyPM: z.number().nonnegative().optional().nullable(),
  ...locationFields
}).refine(pinIsComplete, pinMessage)

const updateFarmerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\d+$/, 'Phone must contain only digits').max(15).optional().nullable(),
  village: z.string().max(100).optional().nullable(),
  defaultRate: z.number().positive().optional(),
  collectAM: z.boolean().optional(),
  collectPM: z.boolean().optional(),
  subscriptionQtyAM: z.number().nonnegative().optional().nullable(),
  subscriptionQtyPM: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  ...locationFields
}).refine(pinIsComplete, pinMessage)

// GET /api/farmers - List all farmers for the business
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { active, search, routeId } = req.query

    const where: Record<string, unknown> = { businessId }

    if (active === 'true') {
      where.isActive = true
    } else if (active === 'false') {
      where.isActive = false
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { village: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Filter by route if specified
    if (routeId && typeof routeId === 'string') {
      where.routes = {
        some: { routeId }
      }
    }

    const farmers = await prisma.farmer.findMany({
      where,
      orderBy: { name: 'asc' }
    })

    return res.json({
      success: true,
      data: farmers
    })
  } catch (error) {
    console.error('List farmers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch farmers'
    })
  }
})


// Following / copying another user's order: GET|PUT /sort-order/follow, POST /sort-order/copy
addOrderFollowRoutes(router, 'farmer')

// GET /api/farmers/sort-order - Get current user's farmer sort order map
// Optional ?shift=MORNING|EVENING: that shift's order. A farmer with no row for the shift falls back
// to the shared (null shift) order, so the order kept before shifts existed still works for both.
// NOTE: Must be before /:id routes to avoid "sort-order" matching as an ID
router.get('/sort-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Following someone: their order (live); see lib/order-follow.ts
    const { userId: me, businessId } = req.user!
    const { ownerId: userId } = await orderOwner(me, businessId, 'farmer')
    const shiftParam = req.query.shift
    const shift: 'MORNING' | 'EVENING' | null = shiftParam === 'MORNING' || shiftParam === 'EVENING' ? shiftParam : null
    const rows = await prisma.userFarmerOrder.findMany({
      where: { userId, shift },
      select: { farmerId: true, sortOrder: true, shift: true }
    })
    if (!shift) return res.json({ success: true, data: rows })
    const shared = await prisma.userFarmerOrder.findMany({
      where: { userId, shift: null },
      select: { farmerId: true, sortOrder: true, shift: true }
    })
    const own = new Set(rows.map((r) => r.farmerId))
    return res.json({ success: true, data: [...rows, ...shared.filter((r) => !own.has(r.farmerId))] })
  } catch (error) {
    console.error('Get farmer sort order error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sort order'
    })
  }
})

// PUT /api/farmers/sort-order - Bulk update sort order for farmers
// NOTE: Must be before /:id routes to avoid "sort-order" matching as an ID
router.put('/sort-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const { orders } = req.body
    await assertOwnOrder(userId, businessId, 'farmer')

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'orders must be a non-empty array'
      })
    }

    // Verify all farmers belong to business
    const farmerIds = orders.map((o: { farmerId: string }) => o.farmerId)
    const farmers = await prisma.farmer.findMany({
      where: { id: { in: farmerIds }, businessId },
      select: { id: true }
    })
    const validIds = new Set(farmers.map((f) => f.id))

    // Replace this user's order for these farmers: a fixed number of statements, however many
    // farmers there are. Shift may be null (one order for both shifts), so rows are deleted per shift.
    // Last entry wins if the same farmer and shift is sent twice
    const valid = [
      ...new Map(
        (orders as { farmerId: string; sortOrder: number; shift?: string }[])
          .filter((o) => validIds.has(o.farmerId))
          .map((o) => {
            const shift: 'MORNING' | 'EVENING' | null = o.shift === 'MORNING' || o.shift === 'EVENING' ? o.shift : null
            const row = { farmerId: o.farmerId, sortOrder: o.sortOrder, shift }
            return [`${row.farmerId}:${row.shift}`, row] as const
          })
      ).values()
    ]
    const shifts = [...new Set(valid.map((o) => o.shift))]
    await prisma.$transaction([
      ...shifts.map((shift) =>
        prisma.userFarmerOrder.deleteMany({
          where: { userId, shift, farmerId: { in: valid.filter((o) => o.shift === shift).map((o) => o.farmerId) } }
        })
      ),
      prisma.userFarmerOrder.createMany({
        data: valid.map((o) => ({ userId, ...o }))
      })
    ])

    return res.json({ success: true, message: 'Sort orders updated' })
  } catch (error) {
    if (error instanceof FollowingOrderError) {
      return res.status(409).json({ success: false, error: error.message, code: 'FOLLOWING_ORDER' })
    }
    console.error('Bulk update sort order error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update sort orders'
    })
  }
})

// GET /api/farmers/:id - Get a single farmer
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    // Entry and payment history are loaded separately (paged) by the apps, not embedded here
    const farmer = await prisma.farmer.findFirst({
      where: { id, businessId }
    })

    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      })
    }

    return res.json({
      success: true,
      data: farmer
    })
  } catch (error) {
    console.error('Get farmer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch farmer'
    })
  }
})

// POST /api/farmers - Create a new farmer
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const validation = createFarmerSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { name, phone, village, defaultRate, collectAM, collectPM, subscriptionQtyAM, subscriptionQtyPM, latitude, longitude, locationAccuracy, landmark } = validation.data

    // Check for duplicate phone within business
    if (phone) {
      const existing = await prisma.farmer.findFirst({
        where: { businessId, phone }
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'A farmer with this phone number already exists'
        })
      }
    }

    const farmer = await prisma.farmer.create({
      data: {
        businessId,
        name,
        phone,
        village,
        defaultRate,
        collectAM: collectAM ?? true,
        collectPM: collectPM ?? false,
        subscriptionQtyAM,
        subscriptionQtyPM,
        latitude,
        longitude,
        locationAccuracy,
        landmark,
        ...pinAudit({ latitude }, req.user!.userId)
      }
    })

    return res.status(201).json({
      success: true,
      data: farmer
    })
  } catch (error) {
    console.error('Create farmer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create farmer'
    })
  }
})

// PUT /api/farmers/:id - Update a farmer
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updateFarmerSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Check farmer exists and belongs to business
    const existing = await prisma.farmer.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      })
    }

    const { phone } = validation.data

    // Check for duplicate phone if changing
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.farmer.findFirst({
        where: { businessId, phone, id: { not: id } }
      })
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'A farmer with this phone number already exists'
        })
      }
    }

    const farmer = await prisma.farmer.update({
      where: { id },
      data: { ...validation.data, ...pinAudit(validation.data, req.user!.userId, existing) }
    })

    return res.json({
      success: true,
      data: farmer
    })
  } catch (error) {
    console.error('Update farmer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update farmer'
    })
  }
})

// DELETE /api/farmers/:id - Soft delete (deactivate) a farmer
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.farmer.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      })
    }

    // Soft delete - just mark as inactive
    await prisma.farmer.update({
      where: { id },
      data: { isActive: false }
    })

    return res.json({
      success: true,
      message: 'Farmer deactivated successfully'
    })
  } catch (error) {
    console.error('Delete farmer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete farmer'
    })
  }
})

// POST /api/farmers/:id/sort-order - Update sort order for a farmer
router.post('/:id/sort-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const farmerId = req.params.id as string
    const { sortOrder } = req.body
    const shift: 'MORNING' | 'EVENING' | null = req.body.shift === 'MORNING' || req.body.shift === 'EVENING' ? req.body.shift : null

    await assertOwnOrder(userId, businessId, 'farmer')

    if (typeof sortOrder !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'sortOrder must be a number'
      })
    }

    // Verify farmer belongs to business
    const farmer = await prisma.farmer.findFirst({
      where: { id: farmerId, businessId }
    })

    if (!farmer) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      })
    }

    // Replace the sort order for this farmer and shift (null shift can't be used in an upsert key)
    await prisma.$transaction([
      prisma.userFarmerOrder.deleteMany({ where: { userId, farmerId, shift } }),
      prisma.userFarmerOrder.create({ data: { userId, farmerId, shift, sortOrder } })
    ])

    return res.json({
      success: true,
      message: 'Sort order updated'
    })
  } catch (error) {
    if (error instanceof FollowingOrderError) {
      return res.status(409).json({ success: false, error: error.message, code: 'FOLLOWING_ORDER' })
    }
    console.error('Update sort order error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update sort order'
    })
  }
})

export default router
