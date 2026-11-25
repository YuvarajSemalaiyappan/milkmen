import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: {
    userId: string
    businessId: string
  }
}

// Staff/owner access tokens carry type 'access' plus userId and businessId. Refresh, admin and
// (later) customer tokens are signed with the same secret, so the type must be checked: a refresh
// token must not work as an access token, and a token without businessId would make
// `where: { businessId: undefined }` match every business. Returns null for anything else.
// Tokens issued before the type existed are refused too; the apps then refresh once (the refresh
// token is unchanged), so nobody is logged out.
export function verifyAccessToken(token: string): { userId: string; businessId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { type?: unknown; userId?: unknown; businessId?: unknown }
    if (decoded.type !== 'access') return null
    if (typeof decoded.userId !== 'string' || !decoded.userId) return null
    if (typeof decoded.businessId !== 'string' || !decoded.businessId) return null
    return { userId: decoded.userId, businessId: decoded.businessId }
  } catch {
    return null
  }
}

// Middleware to verify JWT token
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    })
  }

  const user = verifyAccessToken(token)
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }

  req.user = user
  next()
}

// Middleware to check if user is owner
export async function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { role: true }
    })
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Owner role required' })
    }
    next()
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to verify role' })
  }
}

// Middleware to check if user is owner or manager
export async function requireOwnerOrManager(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { role: true }
    })
    if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) {
      return res.status(403).json({ success: false, error: 'Owner or Manager role required' })
    }
    next()
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to verify role' })
  }
}

export default authenticateToken
