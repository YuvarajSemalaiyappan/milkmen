import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: {
    userId: string
    businessId: string
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      businessId: string
    }

    req.user = {
      userId: decoded.userId,
      businessId: decoded.businessId
    }

    next()
  } catch {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }
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
