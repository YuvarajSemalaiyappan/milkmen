import { Router, Response } from 'express'
import type { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

// GET /api/admin/logs - Failed and slow requests, newest first.
// Filters: businessId, status (exact, or 4xx / 5xx), route (contains), since (ISO date), before (cursor: createdAt ISO).
router.get('/', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { businessId, status, route, since, before } = req.query
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100))

    const where: Prisma.RequestLogWhereInput = {}
    if (typeof businessId === 'string') where.businessId = businessId
    if (status === '4xx') where.status = { gte: 400, lt: 500 }
    else if (status === '5xx') where.status = { gte: 500 }
    else if (typeof status === 'string' && /^\d{3}$/.test(status)) where.status = Number(status)
    if (typeof route === 'string') where.route = { contains: route }
    const createdAt: Prisma.DateTimeFilter = {}
    if (typeof since === 'string') createdAt.gte = new Date(since)
    if (typeof before === 'string') createdAt.lt = new Date(before)
    if (createdAt.gte || createdAt.lt) where.createdAt = createdAt

    const logs = await prisma.requestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return res.json({
      success: true,
      data: logs,
      nextBefore: logs.length === limit ? logs[logs.length - 1].createdAt.toISOString() : null
    })
  } catch (error) {
    console.error('List request logs error:', error)
    return res.status(500).json({ success: false, error: 'Failed to list request logs' })
  }
})

export default router
