import type { Response, Router } from 'express'
import prisma from './prisma.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

// Sharing the collect/deliver order between users of one business.
//
// Follow: a user can follow another user's farmer order and/or customer order (both shifts together).
// While following, every screen gets the followed user's order, live, and the follower can't
// change it (saving answers 409 FOLLOWING_ORDER). Chains resolve: if A follows B and B follows C,
// A gets C's order. A loop can't be made. Stopping (or the followed user being deactivated) leaves
// the follower with a copy of the order they were seeing, so nothing jumps.
// Copy: the other user's (effective) order is copied once and becomes the user's own, editable.
// A user changes this for themselves; the owner can also change it for any staff (userId).

export type OrderKind = 'farmer' | 'customer'

const FIELD = { farmer: 'followFarmerOrderId', customer: 'followCustomerOrderId' } as const
const TABLE = { farmer: '"UserFarmerOrder"', customer: '"UserCustomerOrder"' } as const
const PERSON = { farmer: '"farmerId"', customer: '"customerId"' } as const
const MAX_HOPS = 10

export class FollowingOrderError extends Error {}

type Who = { id: string; name: string }

/** Whose order a user sees: their own, or the end of the follow chain. `following` = who they chose. */
export async function orderOwner(userId: string, businessId: string, kind: OrderKind): Promise<{ ownerId: string; following: Who | null }> {
  const field = FIELD[kind]
  const me = await prisma.user.findFirst({ where: { id: userId, businessId }, select: { [field]: true } }) as Record<string, string | null> | null
  let next = me?.[field] ?? null
  if (!next) return { ownerId: userId, following: null }
  let ownerId = userId
  let following: Who | null = null
  const seen = new Set([userId])
  for (let hop = 0; next && hop < MAX_HOPS && !seen.has(next); hop++) {
    const u = await prisma.user.findFirst({
      where: { id: next, businessId, isActive: true },
      select: { id: true, name: true, [field]: true }
    }) as ({ id: string; name: string } & Record<string, string | null>) | null
    if (!u) break
    if (!following) following = { id: u.id, name: u.name }
    seen.add(u.id)
    ownerId = u.id
    next = u[field] ?? null
  }
  return { ownerId, following }
}

/** Throws FollowingOrderError when the user follows someone (their order can't be changed). */
export async function assertOwnOrder(userId: string, businessId: string, kind: OrderKind) {
  const { following } = await orderOwner(userId, businessId, kind)
  if (following) throw new FollowingOrderError(`Following ${following.name}'s order`)
}

/** Replace `toUserId`'s order (both shifts) with `fromUserId`'s rows. Two statements. */
async function copyRows(fromUserId: string, toUserId: string, kind: OrderKind) {
  if (fromUserId === toUserId) return
  const table = TABLE[kind]
  const person = PERSON[kind]
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE "userId" = $1`, toUserId),
    prisma.$executeRawUnsafe(
      `INSERT INTO ${table} (id, "userId", ${person}, shift, "sortOrder")
       SELECT gen_random_uuid()::text, $2, ${person}, shift, "sortOrder" FROM ${table} WHERE "userId" = $1`,
      fromUserId, toUserId
    )
  ])
}

/** Stop following: keep a copy of the order the user was seeing, then clear the follow. */
async function stopFollowing(userId: string, businessId: string, kind: OrderKind) {
  const { ownerId } = await orderOwner(userId, businessId, kind)
  await copyRows(ownerId, userId, kind)
  await prisma.user.update({ where: { id: userId }, data: { [FIELD[kind]]: null } })
}

/** A user is deactivated: everyone following them keeps a copy of what they were seeing. */
export async function releaseFollowers(userId: string, businessId: string) {
  for (const kind of ['farmer', 'customer'] as const) {
    const followers = await prisma.user.findMany({ where: { businessId, [FIELD[kind]]: userId }, select: { id: true } })
    for (const f of followers) await stopFollowing(f.id, businessId, kind)
  }
}

/** The user the change is for: yourself, or (owner only) a staff member of the business. */
async function targetUser(req: AuthRequest, res: Response): Promise<string | null> {
  const { userId, businessId } = req.user!
  const wanted = typeof req.body?.userId === 'string' && req.body.userId ? req.body.userId : typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : userId
  if (wanted === userId) return userId
  const [me, them] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, businessId }, select: { role: true } }),
    prisma.user.findFirst({ where: { id: wanted, businessId }, select: { id: true } })
  ])
  if (me?.role !== 'OWNER') {
    res.status(403).json({ success: false, error: 'Only the owner can change another user\'s order' })
    return null
  }
  if (!them) {
    res.status(404).json({ success: false, error: 'User not found' })
    return null
  }
  return wanted
}

/**
 * Routes, added to the farmers and customers routers (before /:id):
 *   GET  /sort-order/follow[?userId]   { following, followers, users }  (users = who can be followed or copied, with phoneEnd)
 *   PUT  /sort-order/follow            { followUserId: string | null, userId? }  null = stop following (keeps a copy)
 *   POST /sort-order/copy              { fromUserId, userId? }  copy once; also stops following
 */
export function addOrderFollowRoutes(router: Router, kind: OrderKind) {
  const field = FIELD[kind]

  router.get('/sort-order/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { businessId } = req.user!
      const target = await targetUser(req, res)
      if (!target) return
      const [{ following }, followers, users] = await Promise.all([
        orderOwner(target, businessId, kind),
        prisma.user.findMany({ where: { businessId, isActive: true, [field]: target }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { businessId, isActive: true, id: { not: target } }, select: { id: true, name: true, role: true, phone: true }, orderBy: { name: 'asc' } })
      ])
      // Last 4 digits only, to tell people with the same name apart
      const list = users.map((u) => ({ id: u.id, name: u.name, role: u.role, phoneEnd: u.phone.slice(-4) }))
      return res.json({ success: true, data: { following, followers, users: list } })
    } catch (error) {
      console.error('Get order follow error:', error)
      return res.status(500).json({ success: false, error: 'Failed to load order sharing' })
    }
  })

  router.put('/sort-order/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { businessId } = req.user!
      const target = await targetUser(req, res)
      if (!target) return
      const followUserId = typeof req.body?.followUserId === 'string' && req.body.followUserId ? req.body.followUserId : null

      if (!followUserId) {
        await stopFollowing(target, businessId, kind)
        return res.json({ success: true, data: { following: null } })
      }
      if (followUserId === target) {
        return res.status(400).json({ success: false, error: 'A user can\'t follow their own order', code: 'ORDER_LOOP' })
      }
      const leader = await prisma.user.findFirst({ where: { id: followUserId, businessId, isActive: true }, select: { id: true, name: true } })
      if (!leader) return res.status(404).json({ success: false, error: 'User not found' })
      // No loops: the leader's chain must not come back to the target
      let next: string | null = leader.id
      const seen = new Set<string>()
      for (let hop = 0; next && hop < MAX_HOPS && !seen.has(next); hop++) {
        if (next === target) {
          return res.status(400).json({ success: false, error: `${leader.name} already follows this order`, code: 'ORDER_LOOP' })
        }
        seen.add(next)
        const u = await prisma.user.findFirst({ where: { id: next, businessId }, select: { [field]: true } }) as Record<string, string | null> | null
        next = u?.[field] ?? null
      }
      await prisma.user.update({ where: { id: target }, data: { [field]: leader.id } })
      return res.json({ success: true, data: { following: leader } })
    } catch (error) {
      console.error('Set order follow error:', error)
      return res.status(500).json({ success: false, error: 'Failed to change order sharing' })
    }
  })

  router.post('/sort-order/copy', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { businessId } = req.user!
      const target = await targetUser(req, res)
      if (!target) return
      const fromUserId = typeof req.body?.fromUserId === 'string' ? req.body.fromUserId : ''
      const from = await prisma.user.findFirst({ where: { id: fromUserId, businessId }, select: { id: true } })
      if (!from || from.id === target) return res.status(404).json({ success: false, error: 'User not found' })
      const { ownerId } = await orderOwner(from.id, businessId, kind)
      await copyRows(ownerId, target, kind)
      await prisma.user.update({ where: { id: target }, data: { [field]: null } })
      return res.json({ success: true, data: { following: null } })
    } catch (error) {
      console.error('Copy order error:', error)
      return res.status(500).json({ success: false, error: 'Failed to copy the order' })
    }
  })
}
