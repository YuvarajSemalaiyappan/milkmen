import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, requireOwnerOrManager, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// Validation schemas
const createRateSchema = z.object({
  farmerId: z.string().optional(),
  fatFrom: z.number().min(0).max(15),
  fatTo: z.number().min(0).max(15),
  ratePerLiter: z.number().min(0.01)
}).refine(data => data.fatFrom < data.fatTo, {
  message: 'fatFrom must be less than fatTo',
  path: ['fatFrom']
})

const updateRateSchema = z.object({
  fatFrom: z.number().min(0).max(15).optional(),
  fatTo: z.number().min(0).max(15).optional(),
  ratePerLiter: z.number().min(0.01).optional()
})

// GET /api/rates - Get all rate slabs
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { farmerId } = req.query

    const where: Record<string, unknown> = {
      businessId,
      effectiveTo: null // Only get current rates
    }

    if (farmerId && typeof farmerId === 'string') {
      where.farmerId = farmerId
    }

    const rates = await prisma.rate.findMany({
      where,
      include: {
        farmer: {
          select: { id: true, name: true }
        }
      },
      orderBy: { fatFrom: 'asc' }
    })

    const formattedRates = rates.map(r => ({
      id: r.id,
      businessId: r.businessId,
      farmerId: r.farmerId,
      farmerName: r.farmer?.name || null,
      fatFrom: Number(r.fatFrom),
      fatTo: Number(r.fatTo),
      ratePerLiter: Number(r.ratePerLiter),
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString() || null,
      createdAt: r.createdAt.toISOString()
    }))

    return res.json({ success: true, data: formattedRates })
  } catch (error) {
    console.error('Get rates error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get rates' })
  }
})

// POST /api/rates - Create rate slab (OWNER/MANAGER)
router.post('/', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createRateSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { businessId } = req.user!
    const { farmerId, fatFrom, fatTo, ratePerLiter } = validation.data

    // Check for overlapping rate slabs
    const overlapping = await prisma.rate.findFirst({
      where: {
        businessId,
        farmerId: farmerId || null,
        effectiveTo: null,
        OR: [
          {
            fatFrom: { lte: fatTo },
            fatTo: { gte: fatFrom }
          }
        ]
      }
    })

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'This fat range overlaps with an existing rate slab'
      })
    }

    // Verify farmer belongs to business if farmerId provided
    if (farmerId) {
      const farmer = await prisma.farmer.findFirst({
        where: { id: farmerId, businessId }
      })
      if (!farmer) {
        return res.status(404).json({ success: false, error: 'Farmer not found' })
      }
    }

    const rate = await prisma.rate.create({
      data: {
        businessId,
        farmerId: farmerId || null,
        fatFrom,
        fatTo,
        ratePerLiter
      }
    })

    return res.status(201).json({
      success: true,
      data: {
        id: rate.id,
        businessId: rate.businessId,
        farmerId: rate.farmerId,
        fatFrom: Number(rate.fatFrom),
        fatTo: Number(rate.fatTo),
        ratePerLiter: Number(rate.ratePerLiter),
        effectiveFrom: rate.effectiveFrom.toISOString(),
        effectiveTo: rate.effectiveTo?.toISOString() || null,
        createdAt: rate.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Create rate error:', error)
    return res.status(500).json({ success: false, error: 'Failed to create rate' })
  }
})

// PUT /api/rates/:id - Update rate slab (OWNER/MANAGER)
router.put('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const validation = updateRateSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { businessId } = req.user!

    // Verify rate belongs to business
    const existing = await prisma.rate.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rate not found' })
    }

    const updateData = validation.data
    const newFatFrom = updateData.fatFrom ?? Number(existing.fatFrom)
    const newFatTo = updateData.fatTo ?? Number(existing.fatTo)

    // Validate fat range
    if (newFatFrom >= newFatTo) {
      return res.status(400).json({ success: false, error: 'fatFrom must be less than fatTo' })
    }

    // Check for overlapping rate slabs (excluding current)
    const overlapping = await prisma.rate.findFirst({
      where: {
        businessId,
        farmerId: existing.farmerId,
        effectiveTo: null,
        id: { not: id },
        OR: [
          {
            fatFrom: { lte: newFatTo },
            fatTo: { gte: newFatFrom }
          }
        ]
      }
    })

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'This fat range overlaps with an existing rate slab'
      })
    }

    const rate = await prisma.rate.update({
      where: { id },
      data: updateData
    })

    return res.json({
      success: true,
      data: {
        id: rate.id,
        businessId: rate.businessId,
        farmerId: rate.farmerId,
        fatFrom: Number(rate.fatFrom),
        fatTo: Number(rate.fatTo),
        ratePerLiter: Number(rate.ratePerLiter),
        effectiveFrom: rate.effectiveFrom.toISOString(),
        effectiveTo: rate.effectiveTo?.toISOString() || null,
        createdAt: rate.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Update rate error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update rate' })
  }
})

// DELETE /api/rates/:id - Delete rate slab (OWNER/MANAGER)
router.delete('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { businessId } = req.user!

    // Verify rate belongs to business
    const existing = await prisma.rate.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rate not found' })
    }

    // Soft delete by setting effectiveTo
    await prisma.rate.update({
      where: { id },
      data: { effectiveTo: new Date() }
    })

    return res.json({ success: true, message: 'Rate slab deleted' })
  } catch (error) {
    console.error('Delete rate error:', error)
    return res.status(500).json({ success: false, error: 'Failed to delete rate' })
  }
})

export default router
