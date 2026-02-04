import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '24h'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input' })
    }

    const { email, password } = validation.data

    const admin = await prisma.adminUser.findUnique({
      where: { email }
    })

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash)
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    })

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, type: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    return res.json({
      success: true,
      data: {
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        },
        token
      }
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// GET /api/admin/auth/me
router.get('/me', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.admin!.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        lastLogin: true
      }
    })

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' })
    }

    return res.json({ success: true, data: admin })
  } catch (error) {
    console.error('Admin me error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get admin info' })
  }
})

export default router
