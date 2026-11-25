import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma.js'
import { effectiveStatus, PLAN_ERRORS, PlanLike } from '../lib/plan.js'
import { verifyAccessToken } from './auth.js'

// Write guard: a business whose plan has expired, is suspended or was never activated can still
// log in and read everything, but every save (POST/PUT/PATCH/DELETE) on the app API is refused
// with 402 and a PLAN_* code. Mounted in index.ts on the app routes, before them.
//
// Personal account changes stay open so nobody is locked out of their own login.
const ALWAYS_OPEN = new Set([
  'PUT /api/settings/profile',
  'PUT /api/settings/change-pin'
])

// One small lookup per business per minute (the server runs as one process). Admin actions on a
// plan call clearPlanCache() so a renewal works on the next save.
const CACHE_MS = 60_000
const cache = new Map<string, { plan: PlanLike | null; at: number }>()

export function clearPlanCache(businessId: string) {
  cache.delete(businessId)
}

async function loadPlan(businessId: string): Promise<PlanLike | null> {
  const hit = cache.get(businessId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.plan
  const plan = await prisma.subscription.findUnique({
    where: { businessId },
    select: { status: true, endDate: true }
  })
  cache.set(businessId, { plan, at: Date.now() })
  return plan
}

export async function requireActivePlan(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (ALWAYS_OPEN.has(`${req.method} ${req.baseUrl}${req.path}`)) return next()

  // No or bad token: let the route's own authenticateToken answer 401.
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return next()
  const businessId = verifyAccessToken(token)?.businessId
  if (!businessId) return next()

  try {
    const status = effectiveStatus(await loadPlan(businessId))
    if (status === 'ACTIVE') return next()
    const { code, error } = PLAN_ERRORS[status]
    return res.status(402).json({ success: false, error, code })
  } catch (error) {
    console.error('Plan check error:', error)
    return res.status(500).json({ success: false, error: 'Failed to check plan' })
  }
}
