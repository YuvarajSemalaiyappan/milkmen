import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import type { Prisma } from '@prisma/client'

const router = Router()

// Validation schemas
const createCollectionSchema = z.object({
  localId: z.string().optional(),
  farmerId: z.string(),
  date: z.string(), // ISO date string
  shift: z.enum(['MORNING', 'EVENING']),
  quantity: z.number().positive(),
  fatContent: z.number().min(0).max(10).optional(),
  ratePerLiter: z.number().positive(),
  notes: z.string().max(500).optional()
})

const updateCollectionSchema = z.object({
  quantity: z.number().positive().optional(),
  fatContent: z.number().min(0).max(10).optional().nullable(),
  ratePerLiter: z.number().positive().optional(),
  notes: z.string().max(500).optional().nullable()
})

// GET /api/collections - List collections with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date, farmerId, shift, from, to, routeId } = req.query

    const where: Prisma.CollectionWhereInput = { businessId }

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

    if (shift && (shift === 'MORNING' || shift === 'EVENING')) {
      where.shift = shift
    }

    // Filter by route - get farmers in that route
    if (routeId && typeof routeId === 'string') {
      where.farmer = {
        routes: {
          some: { routeId }
        }
      }
    }

    const collections = await prisma.collection.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        farmer: {
          select: { id: true, name: true, phone: true, village: true }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    })

    return res.json({
      success: true,
      data: collections
    })
  } catch (error) {
    console.error('List collections error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch collections'
    })
  }
})

// GET /api/collections/today - Get today's collections summary
router.get('/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { shift } = req.query

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const where: Prisma.CollectionWhereInput = {
      businessId,
      date: today
    }

    if (shift && (shift === 'MORNING' || shift === 'EVENING')) {
      where.shift = shift
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        farmer: {
          select: { id: true, name: true, village: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate totals
    const totals = collections.reduce(
      (acc, c) => ({
        liters: acc.liters + Number(c.quantity),
        amount: acc.amount + Number(c.totalAmount),
        count: acc.count + 1
      }),
      { liters: 0, amount: 0, count: 0 }
    )

    return res.json({
      success: true,
      data: {
        collections,
        totals
      }
    })
  } catch (error) {
    console.error('Get today collections error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s collections'
    })
  }
})

// GET /api/collections/:id - Get a single collection
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const collection = await prisma.collection.findFirst({
      where: { id, businessId },
      include: {
        farmer: true,
        user: {
          select: { id: true, name: true }
        }
      }
    })

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      })
    }

    return res.json({
      success: true,
      data: collection
    })
  } catch (error) {
    console.error('Get collection error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch collection'
    })
  }
})

// POST /api/collections - Create a new collection
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const validation = createCollectionSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { localId, farmerId, date, shift, quantity, fatContent, ratePerLiter, notes } = validation.data

    // Verify farmer belongs to business
    const farmer = await prisma.farmer.findFirst({
      where: { id: farmerId, businessId, isActive: true }
    })

    if (!farmer) {
      return res.status(400).json({
        success: false,
        error: 'Farmer not found or inactive'
      })
    }

    // Check for duplicate localId
    if (localId) {
      const existing = await prisma.collection.findUnique({
        where: { localId }
      })
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          message: 'Collection already synced'
        })
      }
    }

    const totalAmount = quantity * ratePerLiter

    // Create collection and update farmer balance in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const collection = await tx.collection.create({
        data: {
          localId,
          businessId,
          farmerId,
          collectedBy: userId,
          date: new Date(date),
          shift,
          quantity,
          fatContent,
          ratePerLiter,
          totalAmount,
          originalRate: ratePerLiter,
          notes,
          syncStatus: 'SYNCED'
        },
        include: {
          farmer: {
            select: { id: true, name: true }
          }
        }
      })

      // Update farmer balance (we owe them more)
      await tx.farmer.update({
        where: { id: farmerId },
        data: {
          balance: { increment: totalAmount }
        }
      })

      return collection
    })

    return res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Create collection error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create collection'
    })
  }
})

// PUT /api/collections/:id - Update a collection
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const id = req.params.id as string
    const validation = updateCollectionSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const existing = await prisma.collection.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      })
    }

    const { quantity, fatContent, ratePerLiter, notes } = validation.data
    const newQuantity = quantity ?? Number(existing.quantity)
    const newRate = ratePerLiter ?? Number(existing.ratePerLiter)
    const newTotal = newQuantity * newRate
    const oldTotal = Number(existing.totalAmount)
    const balanceDiff = newTotal - oldTotal

    // Update collection and adjust farmer balance
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const collection = await tx.collection.update({
        where: { id },
        data: {
          quantity: newQuantity,
          fatContent: fatContent !== undefined ? fatContent : existing.fatContent,
          ratePerLiter: newRate,
          totalAmount: newTotal,
          notes: notes !== undefined ? notes : existing.notes,
          rateEditedAt: ratePerLiter ? new Date() : existing.rateEditedAt,
          rateEditedBy: ratePerLiter ? userId : existing.rateEditedBy,
          syncStatus: 'SYNCED'
        }
      })

      // Adjust farmer balance
      if (balanceDiff !== 0) {
        await tx.farmer.update({
          where: { id: existing.farmerId },
          data: {
            balance: { increment: balanceDiff }
          }
        })
      }

      return collection
    })

    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Update collection error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update collection'
    })
  }
})

// DELETE /api/collections/:id - Delete a collection
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.collection.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      })
    }

    // Delete and adjust farmer balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.collection.delete({
        where: { id }
      })

      // Reduce farmer balance
      await tx.farmer.update({
        where: { id: existing.farmerId },
        data: {
          balance: { decrement: Number(existing.totalAmount) }
        }
      })
    })

    return res.json({
      success: true,
      message: 'Collection deleted successfully'
    })
  } catch (error) {
    console.error('Delete collection error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete collection'
    })
  }
})

export default router
