import { Router, Response } from 'express'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

// GET /api/admin/dashboard/stats
router.get('/stats', authenticateAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    // Total businesses
    const totalBusinesses = await prisma.business.count()

    // Active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        endDate: { gte: new Date() }
      }
    })

    // Expiring soon (within 7 days)
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiringSoon = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: sevenDaysFromNow
        }
      }
    })

    // Total revenue from subscription payments
    const revenueResult = await prisma.subscriptionPayment.aggregate({
      _sum: { amount: true }
    })
    const totalRevenue = Number(revenueResult._sum.amount) || 0

    // Recent payments
    const recentPayments = await prisma.subscriptionPayment.findMany({
      take: 10,
      orderBy: { paidAt: 'desc' },
      include: {
        business: {
          select: { id: true, name: true, phone: true }
        }
      }
    })

    // Businesses by plan
    const businessesByPlan = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
      where: {
        status: 'ACTIVE',
        endDate: { gte: new Date() }
      }
    })

    const planCounts: Record<string, number> = {}
    businessesByPlan.forEach(item => {
      planCounts[item.plan] = item._count.plan
    })

    return res.json({
      success: true,
      data: {
        totalBusinesses,
        activeSubscriptions,
        expiringSoon,
        totalRevenue,
        recentPayments: recentPayments.map(p => ({
          id: p.id,
          businessId: p.businessId,
          businessName: p.business.name,
          businessPhone: p.business.phone,
          plan: p.plan,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          transactionId: p.transactionId,
          paidAt: p.paidAt.toISOString(),
          validFrom: p.validFrom.toISOString(),
          validUntil: p.validUntil.toISOString()
        })),
        businessesByPlan: planCounts
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get dashboard stats' })
  }
})

export default router
