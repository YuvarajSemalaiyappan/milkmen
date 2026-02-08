import { Router, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

const PLAN_DAYS: Record<string, number> = {
  FREE: 30,
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 180,
  ANNUAL: 365
}

const activateSchema = z.object({
  plan: z.enum(['FREE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL']),
  amount: z.number().min(0),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional()
})

// POST /api/admin/subscriptions/:businessId/activate
router.post('/:businessId/activate', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const businessId = req.params.businessId as string
    const validation = activateSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { plan, amount, paymentMethod, transactionId, notes } = validation.data

    // Verify business exists
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }

    const now = new Date()
    const endDate = new Date(now.getTime() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000)

    // Create or update subscription
    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan,
        status: 'ACTIVE',
        startDate: now,
        endDate
      },
      update: {
        plan,
        status: 'ACTIVE',
        startDate: now,
        endDate
      }
    })

    // Record payment
    await prisma.subscriptionPayment.create({
      data: {
        businessId,
        plan,
        amount,
        paymentMethod: paymentMethod || null,
        transactionId: transactionId || null,
        notes: notes || null,
        paidAt: now,
        validFrom: now,
        validUntil: endDate,
        recordedBy: req.admin!.adminId
      }
    })

    return res.json({
      success: true,
      data: {
        id: subscription.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null
      }
    })
  } catch (error) {
    console.error('Activate subscription error:', error)
    return res.status(500).json({ success: false, error: 'Failed to activate subscription' })
  }
})

// POST /api/admin/subscriptions/:businessId/extend
router.post('/:businessId/extend', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const businessId = req.params.businessId as string
    const validation = activateSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { plan, amount, paymentMethod, transactionId, notes } = validation.data

    // Get current subscription
    const existing = await prisma.subscription.findUnique({
      where: { businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'No subscription found. Use activate instead.' })
    }

    // Calculate new end date: extend from current end date if still active, otherwise from now
    const now = new Date()
    const baseDate = existing.endDate && existing.endDate > now ? existing.endDate : now
    const newEndDate = new Date(baseDate.getTime() + PLAN_DAYS[plan] * 24 * 60 * 60 * 1000)

    const subscription = await prisma.subscription.update({
      where: { businessId },
      data: {
        plan,
        status: 'ACTIVE',
        startDate: existing.status === 'ACTIVE' ? existing.startDate : now,
        endDate: newEndDate
      }
    })

    // Record payment
    await prisma.subscriptionPayment.create({
      data: {
        businessId,
        plan,
        amount,
        paymentMethod: paymentMethod || null,
        transactionId: transactionId || null,
        notes: notes || null,
        paidAt: now,
        validFrom: baseDate,
        validUntil: newEndDate,
        recordedBy: req.admin!.adminId
      }
    })

    return res.json({
      success: true,
      data: {
        id: subscription.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null
      }
    })
  } catch (error) {
    console.error('Extend subscription error:', error)
    return res.status(500).json({ success: false, error: 'Failed to extend subscription' })
  }
})

// POST /api/admin/subscriptions/:businessId/suspend
router.post('/:businessId/suspend', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const businessId = req.params.businessId as string
    const { reason } = req.body || {}

    const existing = await prisma.subscription.findUnique({
      where: { businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'No subscription found' })
    }

    if (existing.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Can only suspend active subscriptions' })
    }

    const subscription = await prisma.subscription.update({
      where: { businessId },
      data: { status: 'SUSPENDED' }
    })

    return res.json({
      success: true,
      data: {
        id: subscription.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null
      },
      message: reason ? `Suspended: ${reason}` : 'Subscription suspended'
    })
  } catch (error) {
    console.error('Suspend subscription error:', error)
    return res.status(500).json({ success: false, error: 'Failed to suspend subscription' })
  }
})

// POST /api/admin/subscriptions/:businessId/reactivate
router.post('/:businessId/reactivate', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const businessId = req.params.businessId as string

    const existing = await prisma.subscription.findUnique({
      where: { businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'No subscription found' })
    }

    if (existing.status !== 'SUSPENDED') {
      return res.status(400).json({ success: false, error: 'Can only reactivate suspended subscriptions' })
    }

    // Check if subscription is still within valid period
    const now = new Date()
    if (!existing.endDate || existing.endDate <= now) {
      return res.status(400).json({
        success: false,
        error: 'Subscription has expired. Use extend to add more time.'
      })
    }

    const subscription = await prisma.subscription.update({
      where: { businessId },
      data: { status: 'ACTIVE' }
    })

    return res.json({
      success: true,
      data: {
        id: subscription.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate?.toISOString() || null,
        endDate: subscription.endDate?.toISOString() || null
      }
    })
  } catch (error) {
    console.error('Reactivate subscription error:', error)
    return res.status(500).json({ success: false, error: 'Failed to reactivate subscription' })
  }
})

// GET /api/admin/subscriptions/pricing - Get all plan prices
router.get('/pricing', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const pricing = await prisma.planPricing.findMany({
      orderBy: { plan: 'asc' }
    })

    return res.json({
      success: true,
      data: pricing.map((p) => ({
        id: p.id,
        plan: p.plan,
        amount: Number(p.amount),
        updatedAt: p.updatedAt
      }))
    })
  } catch (error) {
    console.error('Get pricing error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get pricing' })
  }
})

// PUT /api/admin/subscriptions/pricing - Update plan prices (bulk)
const pricingSchema = z.object({
  prices: z.array(z.object({
    plan: z.enum(['FREE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL']),
    amount: z.number().min(0)
  }))
})

router.put('/pricing', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const validation = pricingSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { prices } = validation.data

    const results = await Promise.all(
      prices.map((p) =>
        prisma.planPricing.upsert({
          where: { plan: p.plan },
          create: { plan: p.plan, amount: p.amount },
          update: { amount: p.amount }
        })
      )
    )

    return res.json({
      success: true,
      data: results.map((p) => ({
        id: p.id,
        plan: p.plan,
        amount: Number(p.amount),
        updatedAt: p.updatedAt
      }))
    })
  } catch (error) {
    console.error('Update pricing error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update pricing' })
  }
})

export default router
