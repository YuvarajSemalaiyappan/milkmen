import { Router, Response } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma.js'
import { authenticateAdmin, AdminRequest } from '../../middleware/adminAuth.js'

const router = Router()

const STATUSES = ['PENDING', 'DONE', 'REJECTED', 'CANCELLED'] as const

const updateSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'REJECTED']),
  adminNote: z.string().trim().max(500).optional()
})

// GET /api/admin/deletion-requests?status=PENDING - Newest first, at most 200
router.get('/', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined
    const where: Prisma.DeletionRequestWhereInput = {}
    if (status && (STATUSES as readonly string[]).includes(status)) {
      where.status = status as (typeof STATUSES)[number]
    }
    const [requests, pendingCount] = await Promise.all([
      prisma.deletionRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.deletionRequest.count({ where: { status: 'PENDING' } })
    ])
    return res.json({ success: true, data: requests, pendingCount })
  } catch (error) {
    console.error('List deletion requests error:', error)
    return res.status(500).json({ success: false, error: 'Failed to list deletion requests' })
  }
})

// PATCH /api/admin/deletion-requests/:id - Mark done or rejected (or back to pending).
// Deleting the data itself is done with the existing business delete / staff controls.
router.patch('/:id', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const validation = updateSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error.issues })
    }
    const { status, adminNote } = validation.data
    const handled = status !== 'PENDING'
    const request = await prisma.deletionRequest.update({
      where: { id: req.params.id as string },
      data: {
        status,
        handledAt: handled ? new Date() : null,
        handledBy: handled ? req.admin!.adminId : null,
        ...(adminNote !== undefined ? { adminNote: adminNote || null } : {})
      }
    })
    return res.json({ success: true, data: request })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Request not found' })
    }
    console.error('Update deletion request error:', error)
    return res.status(500).json({ success: false, error: 'Failed to update deletion request' })
  }
})

export default router
