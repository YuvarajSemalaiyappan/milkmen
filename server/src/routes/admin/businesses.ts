import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

// GET /api/admin/businesses - List all businesses
router.get('/', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const search = req.query.search as string | undefined
    const status = req.query.status as string | undefined
    const page = req.query.page as string | undefined
    const pageNum = Math.max(1, parseInt(page || '1') || 1)
    const pageSize = 20

    // Build where clause based on search/status
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } }
          ]
        }
      : {}

    const statusFilter = status && status !== 'all'
      ? { subscription: { status: status.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' } }
      : {}

    const where = { ...searchFilter, ...statusFilter }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              farmers: true,
              customers: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize
      }),
      prisma.business.count({ where })
    ])

    const formattedBusinesses = businesses.map(b => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      address: b.address,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      subscription: b.subscription ? {
        id: b.subscription.id,
        businessId: b.subscription.businessId,
        plan: b.subscription.plan,
        status: b.subscription.status,
        startDate: b.subscription.startDate?.toISOString() || null,
        endDate: b.subscription.endDate?.toISOString() || null,
        createdAt: b.subscription.createdAt.toISOString(),
        updatedAt: b.subscription.updatedAt.toISOString()
      } : null,
      _count: b._count
    }))

    return res.json({
      success: true,
      data: formattedBusinesses,
      pagination: {
        page: pageNum,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('List businesses error:', error)
    return res.status(500).json({ success: false, error: 'Failed to list businesses' })
  }
})

// GET /api/admin/businesses/:id - Get business details
router.get('/:id', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = req.params.id as string

    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            farmers: true,
            customers: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }

    return res.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        phone: business.phone,
        address: business.address,
        createdAt: business.createdAt.toISOString(),
        updatedAt: business.updatedAt.toISOString(),
        subscription: business.subscription ? {
          id: business.subscription.id,
          businessId: business.subscription.businessId,
          plan: business.subscription.plan,
          status: business.subscription.status,
          startDate: business.subscription.startDate?.toISOString() || null,
          endDate: business.subscription.endDate?.toISOString() || null,
          createdAt: business.subscription.createdAt.toISOString(),
          updatedAt: business.subscription.updatedAt.toISOString()
        } : null,
        _count: business._count,
        users: business.users.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString()
        }))
      }
    })
  } catch (error) {
    console.error('Get business error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get business' })
  }
})

// GET /api/admin/businesses/:id/subscription - Get subscription details
router.get('/:id/subscription', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = req.params.id as string

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: id }
    })

    return res.json({
      success: true,
      data: subscription ? {
        id: subscription.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString()
      } : null
    })
  } catch (error) {
    console.error('Get subscription error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get subscription' })
  }
})

// GET /api/admin/businesses/:id/payments - Get payment history
router.get('/:id/payments', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = req.params.id as string

    const payments = await prisma.subscriptionPayment.findMany({
      where: { businessId: id },
      orderBy: { paidAt: 'desc' }
    })

    return res.json({
      success: true,
      data: payments.map(p => ({
        id: p.id,
        businessId: p.businessId,
        plan: p.plan,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        transactionId: p.transactionId,
        notes: p.notes,
        paidAt: p.paidAt.toISOString(),
        validFrom: p.validFrom.toISOString(),
        validUntil: p.validUntil.toISOString(),
        recordedBy: p.recordedBy
      }))
    })
  } catch (error) {
    console.error('Get payments error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get payments' })
  }
})

// POST /api/admin/businesses/:id/reset-pin/:userId - Reset user PIN
router.post('/:id/reset-pin/:userId', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const userId = req.params.userId as string

    // Verify user belongs to business
    const user = await prisma.user.findFirst({
      where: { id: userId, businessId: id }
    })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found in this business' })
    }

    // Reset PIN to "1234"
    const pinHash = await bcrypt.hash('1234', 10)
    await prisma.user.update({
      where: { id: userId },
      data: {
        pinHash,
        mustChangePin: true
      }
    })

    return res.json({
      success: true,
      message: `PIN reset for ${user.name}. New PIN: 1234`
    })
  } catch (error) {
    console.error('Reset PIN error:', error)
    return res.status(500).json({ success: false, error: 'Failed to reset PIN' })
  }
})

export default router
