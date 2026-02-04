import { Router } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import prisma from '../../lib/prisma.js'

const router = Router()

// POST /api/setup/init-admin
// Initialize the first admin account (one-time setup via Postman)
router.post('/init-admin', async (req, res) => {
  try {
    const { email, password, name, setupSecret } = req.body

    // 1. Verify setup secret
    if (setupSecret !== process.env.SETUP_SECRET) {
      return res.status(403).json({
        success: false,
        error: 'Invalid setup secret'
      })
    }

    // 2. Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      })
    }

    // 3. Check if admin already exists
    const existingAdmin = await prisma.adminUser.findFirst()
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Admin already exists. This endpoint is disabled.'
      })
    }

    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // 5. Create admin
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name,
        secretKey: crypto.randomUUID()
      }
    })

    // 6. Return success
    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      adminId: admin.id,
      email: admin.email
    })
  } catch (error) {
    console.error('Setup error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin'
    })
  }
})

export default router
