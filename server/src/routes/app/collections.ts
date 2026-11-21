import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import type { Prisma } from '@prisma/client'
import { checkEntryMove, DuplicateEntryError, duplicateResponse, lockEntrySlot, PaidPeriodError } from '../../lib/duplicates.js'
import { lockOwnedRow, NotFoundError, wantsTotal } from '../../lib/db.js'

const router = Router()

// Columns read back by lockOwnedRow (raw query: decimals arrive as Prisma.Decimal)
interface CollectionRow {
  date: Date
  shift: 'MORNING' | 'EVENING'
  createdAt: Date
  farmerId: string
  quantity: Prisma.Decimal
  ratePerLiter: Prisma.Decimal
  totalAmount: Prisma.Decimal
  fatContent: Prisma.Decimal | null
  notes: string | null
  rateEditedAt: Date | null
  rateEditedBy: string | null
}

// Validation schemas
const createCollectionSchema = z.object({
  farmerId: z.string(),
  date: z.string(), // ISO date string
  shift: z.enum(['MORNING', 'EVENING']),
  quantity: z.number().positive(),
  fatContent: z.number().min(0).max(10).optional(),
  ratePerLiter: z.number().positive(),
  notes: z.string().max(500).optional(),
  // Set only after the user confirms they really want a second entry for this shift
  allowDuplicate: z.boolean().optional()
})

const updateCollectionSchema = z.object({
  quantity: z.number().positive().optional(),
  fatContent: z.number().min(0).max(10).optional().nullable(),
  ratePerLiter: z.number().positive().optional(),
  notes: z.string().max(500).optional().nullable(),
  // Move the entry to another day/shift (checked for duplicates and paid periods)
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shift: z.enum(['MORNING', 'EVENING']).optional(),
  allowDuplicate: z.boolean().optional()
})

// GET /api/collections - List collections with filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date, farmerId, shift, from, to, routeId, order, page: pageStr, limit: limitStr } = req.query

    const page = Math.max(1, parseInt(pageStr as string) || 1)
    // A single day is naturally bounded (a busy business has ~300 entries a day), so a date
    // filter returns the whole day; otherwise lists are paged.
    const maxLimit = typeof date === 'string' && date ? 2000 : 500
    const limit = Math.min(maxLimit, Math.max(1, parseInt(limitStr as string) || (maxLimit === 2000 ? 2000 : 200)))
    const skip = (page - 1) * limit

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

    // order=asc gives the oldest first (e.g. limit=1 to find a farmer's first entry)
    const orderBy: Prisma.CollectionOrderByWithRelationInput[] =
      order === 'asc'
        ? [{ date: 'asc' }, { shift: 'asc' }, { createdAt: 'asc' }]
        : [{ date: 'desc' }, { createdAt: 'desc' }]

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          farmer: {
            select: { id: true, name: true, phone: true, village: true }
          },
          user: {
            select: { id: true, name: true }
          }
        }
      }),
      wantsTotal(pageStr) ? prisma.collection.count({ where }) : undefined
    ])

    return res.json({
      success: true,
      data: collections,
      ...(total !== undefined ? { total, page, limit } : {})
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
        farmer: {
          select: { id: true, name: true, phone: true, village: true, defaultRate: true, balance: true, isActive: true }
        },
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

    const { farmerId, date, shift, quantity, fatContent, ratePerLiter, notes, allowDuplicate } = validation.data

    const totalAmount = quantity * ratePerLiter

    // Create collection and update farmer balance in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // One milk entry per farmer per shift, unless the user confirmed another one
      await lockEntrySlot(tx, `collection:${farmerId}:${date}:${shift}`)
      if (!allowDuplicate) {
        const existing = await tx.collection.findMany({
          where: { businessId, farmerId, date: new Date(date), shift },
          select: { id: true, quantity: true }
        })
        if (existing.length) throw new DuplicateEntryError(existing)
      }

      // Update farmer balance (we owe them more). This also checks the farmer belongs to the
      // business and is active, so no separate lookup is needed.
      const updated = await tx.farmer.updateMany({
        where: { id: farmerId, businessId, isActive: true },
        data: { balance: { increment: totalAmount } }
      })
      if (updated.count === 0) throw new NotFoundError('Farmer not found or inactive')

      return tx.collection.create({
        data: {
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
      return res.status(409).json(duplicateResponse('collection', error.existing))
    }
    if (error instanceof NotFoundError) {
      return res.status(400).json({ success: false, error: error.message })
    }
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

    const { quantity, fatContent, ratePerLiter, notes, date, shift, allowDuplicate } = validation.data

    // Update collection and adjust farmer balance. The row is read and locked inside the
    // transaction so two edits at once cannot both apply their balance change.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await lockOwnedRow<CollectionRow>(tx, 'Collection', id, businessId)

      // Moving to another day/shift: blocked inside paid periods, duplicate-checked like a new entry
      const fromDate = new Date(existing.date).toISOString().slice(0, 10)
      const toDate = date ?? fromDate
      const toShift = shift ?? existing.shift
      const moving = toDate !== fromDate || toShift !== existing.shift
      if (moving) {
        await checkEntryMove(tx, {
          kind: 'collection',
          businessId,
          personId: existing.farmerId,
          entryId: id,
          entryCreatedAt: new Date(existing.createdAt),
          fromDate,
          fromShift: existing.shift,
          toDate,
          toShift,
          allowDuplicate
        })
      }

      const newQuantity = quantity ?? Number(existing.quantity)
      const newRate = ratePerLiter ?? Number(existing.ratePerLiter)
      const newTotal = newQuantity * newRate
      const balanceDiff = newTotal - Number(existing.totalAmount)

      const collection = await tx.collection.update({
        where: { id },
        data: {
          ...(moving ? { date: new Date(toDate), shift: toShift } : {}),
          quantity: newQuantity,
          fatContent: fatContent !== undefined ? fatContent : existing.fatContent,
          ratePerLiter: newRate,
          totalAmount: newTotal,
          notes: notes !== undefined ? notes : existing.notes,
          rateEditedAt: ratePerLiter ? new Date() : existing.rateEditedAt,
          rateEditedBy: ratePerLiter ? userId : existing.rateEditedBy
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
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (error instanceof DuplicateEntryError) {
      return res.status(409).json(duplicateResponse('collection', error.existing))
    }
    if (error instanceof PaidPeriodError) {
      return res.status(409).json({ success: false, code: 'PAID_PERIOD', error: error.message })
    }
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

    // Delete and adjust farmer balance
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await lockOwnedRow<CollectionRow>(tx, 'Collection', id, businessId)
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
    if (error instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    console.error('Delete collection error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete collection'
    })
  }
})

export default router
