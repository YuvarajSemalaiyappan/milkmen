import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import { authenticateToken, requireOwner, requireOwnerOrManager, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2).max(100)
})

const changePinSchema = z.object({
  currentPin: z.string().length(4),
  newPin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits')
})

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().max(500).nullable().optional()
})

const addStaffSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  pin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits'),
  role: z.enum(['STAFF', 'MANAGER'])
})

const updateStaffSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['STAFF', 'MANAGER']).optional(),
  isActive: z.boolean().optional()
})

// GET /api/settings/profile - Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    return res.json({ success: true, data: user })
  } catch (error) {
    console.error('Get profile error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get profile' })
  }
})

// PUT /api/settings/profile - Update profile (name only)
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name: validation.data.name },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true
      }
    })

    return res.json({ success: true, data: user })
  } catch (error) {
    console.error('Update profile error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update profile' })
  }
})

// PUT /api/settings/change-pin - Change own PIN
router.put('/change-pin', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = changePinSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { currentPin, newPin } = validation.data

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const pinValid = await bcrypt.compare(currentPin, user.pinHash)
    if (!pinValid) {
      return res.status(401).json({ success: false, error: 'Current PIN is incorrect' })
    }

    const newPinHash = await bcrypt.hash(newPin, 10)
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { pinHash: newPinHash, mustChangePin: false }
    })

    return res.json({ success: true, message: 'PIN changed successfully' })
  } catch (error) {
    console.error('Change PIN error:', error)
    return res.status(500).json({ success: false, error: 'Failed to change PIN' })
  }
})

// GET /api/settings/business - Get business details
router.get('/business', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }

    return res.json({ success: true, data: business })
  } catch (error) {
    console.error('Get business error:', error)
    return res.status(500).json({ success: false, error: 'Failed to get business details' })
  }
})

// PUT /api/settings/business - Update business (OWNER/MANAGER)
router.put('/business', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const validation = updateBusinessSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const business = await prisma.business.update({
      where: { id: req.user!.businessId },
      data: {
        name: validation.data.name,
        address: validation.data.address ?? undefined
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return res.json({ success: true, data: business })
  } catch (error) {
    console.error('Update business error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update business' })
  }
})

// GET /api/settings/staff - List staff (OWNER only)
router.get('/staff', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { businessId: req.user!.businessId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    })

    return res.json({ success: true, data: staff })
  } catch (error) {
    console.error('List staff error:', error)
    return res.status(500).json({ success: false, error: 'Failed to list staff' })
  }
})

// POST /api/settings/staff - Add staff (OWNER only)
router.post('/staff', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const validation = addStaffSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    const { name, phone, pin, role } = validation.data

    // Check if phone already exists in this business
    const existing = await prisma.user.findFirst({
      where: { businessId: req.user!.businessId, phone }
    })

    if (existing) {
      return res.status(400).json({ success: false, error: 'Phone number already exists in this business' })
    }

    const pinHash = await bcrypt.hash(pin, 10)

    const user = await prisma.user.create({
      data: {
        businessId: req.user!.businessId,
        name,
        phone,
        pinHash,
        role,
        mustChangePin: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return res.status(201).json({ success: true, data: user })
  } catch (error) {
    console.error('Add staff error:', error)
    return res.status(500).json({ success: false, error: 'Failed to add staff' })
  }
})

// PUT /api/settings/staff/:id - Update staff (OWNER only)
router.put('/staff/:id', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const validation = updateStaffSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }

    // Verify the staff member belongs to the same business
    const existing = await prisma.user.findFirst({
      where: { id, businessId: req.user!.businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' })
    }

    // Prevent modifying the owner's own role
    if (existing.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot modify owner account' })
    }

    const user = await prisma.user.update({
      where: { id },
      data: validation.data,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return res.json({ success: true, data: user })
  } catch (error) {
    console.error('Update staff error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update staff' })
  }
})

// DELETE /api/settings/staff/:id - Deactivate staff (OWNER only)
router.delete('/staff/:id', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string

    // Verify the staff member belongs to the same business
    const existing = await prisma.user.findFirst({
      where: { id, businessId: req.user!.businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' })
    }

    if (existing.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot delete owner account' })
    }

    // Soft delete - deactivate instead of hard delete
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    })

    return res.json({ success: true, message: 'Staff member deactivated' })
  } catch (error) {
    console.error('Delete staff error:', error)
    return res.status(500).json({ success: false, error: 'Failed to delete staff' })
  }
})

// POST /api/settings/staff/:id/reset-pin - Reset staff PIN (OWNER only)
router.post('/staff/:id/reset-pin', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string

    // Verify the staff member belongs to the same business
    const existing = await prisma.user.findFirst({
      where: { id, businessId: req.user!.businessId }
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' })
    }

    if (existing.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot reset owner PIN through this endpoint' })
    }

    // Reset to default PIN "1234"
    const defaultPin = '1234'
    const pinHash = await bcrypt.hash(defaultPin, 10)

    await prisma.user.update({
      where: { id },
      data: {
        pinHash,
        mustChangePin: true
      }
    })

    return res.json({
      success: true,
      message: 'PIN has been reset. Staff must change it on first login.',
      data: { tempPin: defaultPin }
    })
  } catch (error) {
    console.error('Reset PIN error:', error)
    return res.status(500).json({ success: false, error: 'Failed to reset PIN' })
  }
})

export default router
