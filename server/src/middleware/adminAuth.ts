import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AdminRequest extends Request {
  admin?: {
    adminId: string
    email: string
  }
}

export function authenticateAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Admin access token required'
    })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      adminId: string
      email: string
      type: string
    }

    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin token'
      })
    }

    req.admin = {
      adminId: decoded.adminId,
      email: decoded.email
    }

    next()
  } catch {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired admin token'
    })
  }
}

export default authenticateAdmin
