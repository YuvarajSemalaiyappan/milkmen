import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, requireOwnerOrManager, AuthRequest } from '../../middleware/auth.js'

const router = Router()

const createAreaSchema = z.object({
  routeId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

const updateAreaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
})

// GET /api/areas?routeId=xxx - List areas for a route
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { routeId } = req.query

    if (!routeId) {
      return res.status(400).json({ success: false, error: 'routeId is required' })
    }

    // Verify route belongs to business
    const route = await prisma.route.findFirst({
      where: { id: routeId as string, businessId }
    })
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' })
    }

    const areas = await prisma.area.findMany({
      where: { routeId: routeId as string },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { routeCustomers: true } }
      }
    })

    return res.json({ success: true, data: areas })
  } catch (error) {
    console.error('List areas error:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch areas' })
  }
})

// POST /api/areas - Create area
router.post('/', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const validation = createAreaSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { routeId, name, description } = validation.data

    // Verify route belongs to business
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' })
    }

    // Check duplicate name within route
    const existing = await prisma.area.findFirst({
      where: { routeId, name }
    })
    if (existing) {
      return res.status(400).json({ success: false, error: 'An area with this name already exists in this route' })
    }

    // Get max sortOrder
    const maxSort = await prisma.area.findFirst({
      where: { routeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    const area = await prisma.area.create({
      data: {
        routeId,
        name,
        description,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1
      },
      include: {
        _count: { select: { routeCustomers: true } }
      }
    })

    return res.status(201).json({ success: true, data: area })
  } catch (error) {
    console.error('Create area error:', error)
    return res.status(500).json({ success: false, error: 'Failed to create area' })
  }
})

// PUT /api/areas/:id - Update area
router.put('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updateAreaSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    // Verify area belongs to business via route
    const existing = await prisma.area.findFirst({
      where: { id },
      include: { route: { select: { businessId: true } } }
    })

    if (!existing || existing.route.businessId !== businessId) {
      return res.status(404).json({ success: false, error: 'Area not found' })
    }

    const { name } = validation.data
    if (name && name !== existing.name) {
      const duplicate = await prisma.area.findFirst({
        where: { routeId: existing.routeId, name, id: { not: id } }
      })
      if (duplicate) {
        return res.status(400).json({ success: false, error: 'An area with this name already exists in this route' })
      }
    }

    const area = await prisma.area.update({
      where: { id },
      data: validation.data
    })

    return res.json({ success: true, data: area })
  } catch (error) {
    console.error('Update area error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update area' })
  }
})

// DELETE /api/areas/:id - Delete area
router.delete('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.area.findFirst({
      where: { id },
      include: { route: { select: { businessId: true } } }
    })

    if (!existing || existing.route.businessId !== businessId) {
      return res.status(404).json({ success: false, error: 'Area not found' })
    }

    await prisma.area.delete({ where: { id } })

    return res.json({ success: true, message: 'Area deleted successfully' })
  } catch (error) {
    console.error('Delete area error:', error)
    return res.status(500).json({ success: false, error: 'Failed to delete area' })
  }
})

export default router
