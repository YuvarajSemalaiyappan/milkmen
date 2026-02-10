import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// Validation schemas
const createFarmerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).optional(),
  village: z.string().max(100).optional(),
  defaultRate: z.number().positive()
})

const updateFarmerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional().nullable(),
  village: z.string().max(100).optional().nullable(),
  defaultRate: z.number().positive().optional(),
  isActive: z.boolean().optional()
})

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
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { collections: true, payments: true }
        }
      }
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

// GET /api/farmers/:id - Get a single farmer
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const farmer = await prisma.farmer.findFirst({
      where: { id, businessId },
      include: {
        collections: {
          orderBy: { date: 'desc' },
          take: 10
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
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

// PUT /api/farmers/sort-order - Bulk update sort order for farmers
// NOTE: Must be before /:id routes to avoid "sort-order" matching as an ID
router.put('/sort-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const { orders } = req.body

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

    // Upsert sort orders in a transaction
    await prisma.$transaction(
      orders
        .filter((o: { farmerId: string }) => validIds.has(o.farmerId))
        .map((o: { farmerId: string; sortOrder: number }) =>
          prisma.userFarmerOrder.upsert({
            where: { userId_farmerId: { userId, farmerId: o.farmerId } },
            update: { sortOrder: o.sortOrder },
            create: { userId, farmerId: o.farmerId, sortOrder: o.sortOrder }
          })
        )
    )

    return res.json({ success: true, message: 'Sort orders updated' })
  } catch (error) {
    console.error('Bulk update sort order error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update sort orders'
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

    const { name, phone, village, defaultRate } = validation.data

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
        defaultRate
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
      data: validation.data
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

    // Upsert sort order
    await prisma.userFarmerOrder.upsert({
      where: {
        userId_farmerId: { userId, farmerId }
      },
      update: { sortOrder },
      create: { userId, farmerId, sortOrder }
    })

    return res.json({
      success: true,
      message: 'Sort order updated'
    })
  } catch (error) {
    console.error('Update sort order error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update sort order'
    })
  }
})

export default router
