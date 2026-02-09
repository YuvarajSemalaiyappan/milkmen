import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// Validation schemas
const createCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15).optional(),
  address: z.string().max(200).optional(),
  defaultRate: z.number().positive(),
  subscriptionQtyAM: z.number().positive().optional(),
  subscriptionQtyPM: z.number().positive().optional()
})

const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  defaultRate: z.number().positive().optional(),
  subscriptionQtyAM: z.number().positive().optional().nullable(),
  subscriptionQtyPM: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional()
})

// GET /api/customers - List all customers for the business
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { active, search, subscribed, routeId } = req.query

    const where: Record<string, unknown> = { businessId }

    if (active === 'true') {
      where.isActive = true
    } else if (active === 'false') {
      where.isActive = false
    }

    if (subscribed === 'true') {
      where.OR = [
        { subscriptionQtyAM: { not: null } },
        { subscriptionQtyPM: { not: null } }
      ]
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { address: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Filter by route if specified
    if (routeId && typeof routeId === 'string') {
      where.routes = {
        some: { routeId }
      }
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { deliveries: true, payments: true }
        }
      }
    })

    return res.json({
      success: true,
      data: customers
    })
  } catch (error) {
    console.error('List customers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    })
  }
})

// GET /api/customers/subscribed - Get customers with subscriptions for a shift
router.get('/subscribed', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { shift } = req.query

    const where: Record<string, unknown> = {
      businessId,
      isActive: true
    }

    if (shift === 'MORNING') {
      where.subscriptionQtyAM = { not: null }
    } else if (shift === 'EVENING') {
      where.subscriptionQtyPM = { not: null }
    } else {
      where.OR = [
        { subscriptionQtyAM: { not: null } },
        { subscriptionQtyPM: { not: null } }
      ]
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' }
    })

    return res.json({
      success: true,
      data: customers
    })
  } catch (error) {
    console.error('List subscribed customers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscribed customers'
    })
  }
})

// GET /api/customers/:id - Get a single customer
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const customer = await prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        deliveries: {
          orderBy: { date: 'desc' },
          take: 10
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    })

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      })
    }

    return res.json({
      success: true,
      data: customer
    })
  } catch (error) {
    console.error('Get customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    })
  }
})

// POST /api/customers - Create a new customer
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const validation = createCustomerSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { name, phone, address, defaultRate, subscriptionQtyAM, subscriptionQtyPM } = validation.data

    // Check for duplicate phone within business
    if (phone) {
      const existing = await prisma.customer.findFirst({
        where: { businessId, phone }
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'A customer with this phone number already exists'
        })
      }
    }

    const customer = await prisma.customer.create({
      data: {
        businessId,
        name,
        phone,
        address,
        defaultRate,
        subscriptionQtyAM,
        subscriptionQtyPM
      }
    })

    return res.status(201).json({
      success: true,
      data: customer
    })
  } catch (error) {
    console.error('Create customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    })
  }
})

// PUT /api/customers/:id - Update a customer
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updateCustomerSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Check customer exists and belongs to business
    const existing = await prisma.customer.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      })
    }

    const { phone } = validation.data

    // Check for duplicate phone if changing
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: { businessId, phone, id: { not: id } }
      })
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'A customer with this phone number already exists'
        })
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: validation.data
    })

    return res.json({
      success: true,
      data: customer
    })
  } catch (error) {
    console.error('Update customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    })
  }
})

// DELETE /api/customers/:id - Soft delete (deactivate) a customer
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.customer.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      })
    }

    // Soft delete - just mark as inactive
    await prisma.customer.update({
      where: { id },
      data: { isActive: false }
    })

    return res.json({
      success: true,
      message: 'Customer deactivated successfully'
    })
  } catch (error) {
    console.error('Delete customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete customer'
    })
  }
})

// POST /api/customers/:id/sort-order - Update sort order for a customer
router.post('/:id/sort-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const customerId = req.params.id as string
    const { sortOrder, shift } = req.body

    if (typeof sortOrder !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'sortOrder must be a number'
      })
    }

    // Verify customer belongs to business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId }
    })

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      })
    }

    // Upsert sort order
    await prisma.userCustomerOrder.upsert({
      where: {
        userId_customerId_shift: { userId, customerId, shift: shift || null }
      },
      update: { sortOrder },
      create: { userId, customerId, sortOrder, shift: shift || null }
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
