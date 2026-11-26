import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { effectiveStatus } from '../../lib/plan.js'
import type { Prisma } from '@prisma/client'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'
const REFRESH_TOKEN_EXPIRES_IN = '30d'

// Validation schemas
const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  pin: z.string().length(4)
})

const registerSchema = z.object({
  businessName: z.string().min(2).max(100),
  ownerName: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  pin: z.string().length(4),
  address: z.string().optional()
})

// Generate tokens
function generateTokens(userId: string, businessId: string) {
  const token = jwt.sign(
    { userId, businessId, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  const refreshToken = jwt.sign(
    { userId, businessId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  )

  return { token, refreshToken }
}

// The login screen asks whether a number has an account before the PIN step, so new people are
// sent to Create Account. Limited per address so the list of numbers can't be scraped.
const CHECK_LIMIT = 30
const CHECK_WINDOW_MS = 15 * 60 * 1000
const checkHits = new Map<string, { count: number; start: number }>()

function tooManyChecks(req: import('express').Request): boolean {
  const forwarded = req.headers['x-forwarded-for']
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  if (checkHits.size > 10_000) {
    for (const [k, v] of checkHits) if (now - v.start > CHECK_WINDOW_MS) checkHits.delete(k)
  }
  const hit = checkHits.get(key)
  if (!hit || now - hit.start > CHECK_WINDOW_MS) {
    checkHits.set(key, { count: 1, start: now })
    return false
  }
  hit.count += 1
  return hit.count > CHECK_LIMIT
}

const checkPhoneSchema = z.object({ phone: z.string().min(10).max(15) })

// POST /api/auth/check-phone - { exists } for an active login with this phone number
router.post('/check-phone', async (req, res) => {
  try {
    if (tooManyChecks(req)) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' })
    }
    const validation = checkPhoneSchema.safeParse(req.body ?? {})
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input' })
    }
    const user = await prisma.user.findFirst({
      where: { phone: validation.data.phone, isActive: true },
      select: { id: true }
    })
    return res.json({ success: true, data: { exists: !!user } })
  } catch (error) {
    console.error('Check phone error:', error)
    return res.status(500).json({ success: false, error: 'Failed to check phone number' })
  }
})

// POST /api/auth/register - Register new business
router.post('/register', async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { businessName, ownerName, phone, pin, address } = validation.data

    // Check if phone already exists
    const existingBusiness = await prisma.business.findUnique({
      where: { phone }
    })

    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        error: 'Phone number already registered'
      })
    }

    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 10)

    // Create business and owner in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create business
      const business = await tx.business.create({
        data: {
          name: businessName,
          phone,
          address
        }
      })

      // Create owner user
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: ownerName,
          phone,
          pinHash,
          role: 'OWNER'
        }
      })

      // Create FREE trial subscription (active for 30 days)
      const now = new Date()
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      await tx.subscription.create({
        data: {
          businessId: business.id,
          plan: 'FREE',
          status: 'ACTIVE',
          startDate: now,
          endDate
        }
      })

      return { business, user }
    })

    // Generate tokens
    const tokens = generateTokens(result.user.id, result.business.id)

    return res.status(201).json({
      success: true,
      message: 'Business registered successfully',
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          phone: result.user.phone,
          role: result.user.role,
          businessId: result.business.id
        },
        business: {
          id: result.business.id,
          name: result.business.name
        },
        subscription: {
          plan: 'FREE',
          status: 'ACTIVE',
          active: true,
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          daysRemaining: 30
        },
        ...tokens
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({
      success: false,
      error: 'Registration failed'
    })
  }
})

// POST /api/auth/login - Login with phone + PIN
router.post('/login', async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input'
      })
    }

    const { phone, pin } = validation.data

    // Find user by phone (across all businesses)
    const user = await prisma.user.findFirst({
      where: {
        phone,
        isActive: true
      },
      include: {
        business: {
          include: {
            subscription: true
          }
        }
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or PIN'
      })
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(pin, user.pinHash)
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or PIN'
      })
    }

    // Check subscription status
    const subscription = user.business.subscription
    const subscriptionStatus = effectiveStatus(subscription)
    const subscriptionActive = subscriptionStatus === 'ACTIVE'

    // Calculate days remaining
    let daysRemaining = 0
    if (subscription?.endDate) {
      daysRemaining = Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }

    // Generate tokens
    const tokens = generateTokens(user.id, user.businessId)

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          businessId: user.businessId,
          mustChangePin: user.mustChangePin
        },
        business: {
          id: user.business.id,
          name: user.business.name
        },
        subscription: {
          plan: subscription?.plan || 'FREE',
          status: subscriptionStatus,
          active: subscriptionActive,
          endDate: subscription?.endDate,
          daysRemaining
        },
        ...tokens
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    })
  }
})

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      })
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as {
      userId: string
      businessId: string
      type: string
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      })
    }

    // Check if user still exists and is active
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      })
    }

    // Generate new tokens
    const tokens = generateTokens(user.id, user.businessId)

    return res.json({
      success: true,
      data: tokens
    })
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    })
  }
})

// POST /api/auth/change-pin - Change PIN
router.post('/change-pin', async (req, res) => {
  try {
    const { userId, currentPin, newPin } = req.body

    if (!userId || !currentPin || !newPin) {
      return res.status(400).json({
        success: false,
        error: 'User ID, current PIN, and new PIN are required'
      })
    }

    if (newPin.length !== 4) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be 4 digits'
      })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    // Verify current PIN
    const pinValid = await bcrypt.compare(currentPin, user.pinHash)
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Current PIN is incorrect'
      })
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10)

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        pinHash: newPinHash,
        mustChangePin: false
      }
    })

    return res.json({
      success: true,
      message: 'PIN changed successfully'
    })
  } catch (error) {
    console.error('Change PIN error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to change PIN'
    })
  }
})

export default router
