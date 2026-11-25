import { Router, Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'

// Account deletion requests. Nothing is deleted here: a request is saved, and the admin deletes
// the business (owner) or the login (staff) from the admin panel and marks the request DONE.
// Google Play needs both an in-app way and a web page that works without the app, so there is a
// signed-in route (both apps) and a public one (the web app's /delete-account page).
// Mounted outside the plan guard: a business with an expired plan can still ask to be deleted.

const router = Router()

const REQUEST_SELECT = { id: true, createdAt: true, status: true } as const

const appRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
})

const publicRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?\d{10,15}$/, 'Phone must be 10 to 15 digits'),
  businessName: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(500).optional()
})

// GET /api/account/deletion-request - This user's pending request, or null
router.get('/deletion-request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.deletionRequest.findFirst({
      where: { userId: req.user!.userId, status: 'PENDING' },
      select: REQUEST_SELECT,
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: request })
  } catch (error) {
    console.error('Get deletion request error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get deletion request' })
  }
})

// POST /api/account/deletion-request - Ask for this account to be deleted.
// Sending it again while one is pending returns the pending one.
router.post('/deletion-request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = appRequestSchema.safeParse(req.body ?? {})
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }
    const { userId, businessId } = req.user!

    const [user, pending] = await Promise.all([
      prisma.user.findFirst({
        where: { id: userId, businessId },
        select: { name: true, phone: true, role: true, business: { select: { name: true } } }
      }),
      prisma.deletionRequest.findFirst({
        where: { userId, status: 'PENDING' },
        select: REQUEST_SELECT
      })
    ])
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    if (pending) {
      return res.json({ success: true, data: pending })
    }

    const request = await prisma.deletionRequest.create({
      data: {
        source: 'APP',
        userId,
        businessId,
        role: user.role,
        name: user.name,
        phone: user.phone,
        businessName: user.business.name,
        reason: validation.data.reason || null
      },
      select: REQUEST_SELECT
    })
    return res.status(201).json({ success: true, data: request })
  } catch (error) {
    console.error('Create deletion request error:', error)
    return res.status(500).json({ success: false, error: 'Failed to send deletion request' })
  }
})

// DELETE /api/account/deletion-request - Withdraw this user's pending request
router.delete('/deletion-request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.deletionRequest.updateMany({
      where: { userId: req.user!.userId, status: 'PENDING' },
      data: { status: 'CANCELLED', handledAt: new Date() }
    })
    return res.json({ success: true, data: null })
  } catch (error) {
    console.error('Cancel deletion request error:', error)
    return res.status(500).json({ success: false, error: 'Failed to withdraw deletion request' })
  }
})

// Public form: at most a few requests per address per hour (the server runs as one process).
const PUBLIC_LIMIT = 5
const PUBLIC_WINDOW_MS = 60 * 60 * 1000
const publicHits = new Map<string, { count: number; start: number }>()

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req.socket.remoteAddress || 'unknown'
}

function tooManyPublicRequests(key: string): boolean {
  const now = Date.now()
  if (publicHits.size > 10_000) {
    for (const [k, v] of publicHits) if (now - v.start > PUBLIC_WINDOW_MS) publicHits.delete(k)
  }
  const hit = publicHits.get(key)
  if (!hit || now - hit.start > PUBLIC_WINDOW_MS) {
    publicHits.set(key, { count: 1, start: now })
    return false
  }
  hit.count += 1
  return hit.count > PUBLIC_LIMIT
}

// POST /api/account/deletion-request/public - From the public /delete-account page (no sign-in).
// The admin checks the phone number against the business before deleting anything.
router.post('/deletion-request/public', async (req: Request, res: Response) => {
  try {
    if (tooManyPublicRequests(clientKey(req))) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' })
    }
    const validation = publicRequestSchema.safeParse(req.body ?? {})
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }
    const { name, phone, businessName, reason } = validation.data

    const pending = await prisma.deletionRequest.findFirst({
      where: { phone, status: 'PENDING' },
      select: REQUEST_SELECT
    })
    if (pending) {
      return res.json({ success: true, data: pending })
    }

    const request = await prisma.deletionRequest.create({
      data: {
        source: 'WEB_FORM',
        name,
        phone,
        businessName: businessName || null,
        reason: reason || null
      },
      select: REQUEST_SELECT
    })
    return res.status(201).json({ success: true, data: request })
  } catch (error) {
    console.error('Create public deletion request error:', error)
    return res.status(500).json({ success: false, error: 'Failed to send deletion request' })
  }
})

export default router
