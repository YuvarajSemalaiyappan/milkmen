import { Router, Response } from 'express'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'
import type { Prisma } from '@prisma/client'

const router = Router()

// Valid tables and operations for sync push
const VALID_TABLES = ['farmers', 'customers', 'collections', 'deliveries', 'payments'] as const
const VALID_OPERATIONS = ['create', 'update', 'delete'] as const
type SyncTable = typeof VALID_TABLES[number]
type SyncOperation = typeof VALID_OPERATIONS[number]

// GET /api/sync/pull - Pull changes from server since last sync
router.get('/pull', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { since } = req.query

    const sinceTimestamp = since && typeof since === 'string' ? Number(since) : 0
    const sinceDate = !isNaN(sinceTimestamp) && sinceTimestamp > 0
      ? new Date(sinceTimestamp)
      : new Date(0)

    // Fetch all updated data since the given timestamp
    const [farmers, customers, collections, deliveries, payments] = await Promise.all([
      prisma.farmer.findMany({
        where: {
          businessId,
          updatedAt: { gt: sinceDate }
        },
        orderBy: { updatedAt: 'asc' }
      }),
      prisma.customer.findMany({
        where: {
          businessId,
          updatedAt: { gt: sinceDate }
        },
        orderBy: { updatedAt: 'asc' }
      }),
      prisma.collection.findMany({
        where: {
          businessId,
          updatedAt: { gt: sinceDate }
        },
        include: {
          farmer: {
            select: { id: true, name: true }
          }
        },
        orderBy: { updatedAt: 'asc' }
      }),
      prisma.delivery.findMany({
        where: {
          businessId,
          updatedAt: { gt: sinceDate }
        },
        include: {
          customer: {
            select: { id: true, name: true }
          }
        },
        orderBy: { updatedAt: 'asc' }
      }),
      prisma.payment.findMany({
        where: {
          businessId,
          createdAt: { gt: sinceDate }
        },
        include: {
          farmer: {
            select: { id: true, name: true }
          },
          customer: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ])

    const serverTime = new Date().toISOString()

    return res.json({
      success: true,
      data: {
        farmers,
        customers,
        collections,
        deliveries,
        payments,
        serverTime
      }
    })
  } catch (error) {
    console.error('Sync pull error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to pull sync data',
      detail: error instanceof Error ? error.message : String(error)
    })
  }
})

// POST /api/sync/push - Push a single local change to server
// Frontend sends: { table, operation, data }
router.post('/push', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, businessId } = req.user!
    const { table, operation, data } = req.body

    if (!table || !VALID_TABLES.includes(table) || !operation || !VALID_OPERATIONS.includes(operation) || !data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: requires table, operation, and data'
      })
    }
    let result: unknown = null

    switch (table) {
      case 'farmers': {
        if (operation === 'create') {
          const existing = data.localId ? await prisma.farmer.findFirst({
            where: { businessId, phone: data.phone as string || undefined }
          }) : null

          if (existing) {
            result = existing
            break
          }

          result = await prisma.farmer.create({
            data: {
              businessId,
              name: data.name as string,
              phone: (data.phone as string) || null,
              village: (data.village as string) || null,
              defaultRate: data.defaultRate as number,
              collectAM: (data.collectAM as boolean) ?? true,
              collectPM: (data.collectPM as boolean) ?? false,
            }
          })
        } else if (operation === 'update') {
          let id = data.id as string

          // Resolve local_ IDs by looking up by phone
          if (id.startsWith('local_') && data.phone) {
            const found = await prisma.farmer.findFirst({
              where: { businessId, phone: data.phone as string }
            })
            if (found) id = found.id
            else { result = { skipped: true, reason: 'Record not found for local ID' }; break }
          }

          const updateData: Record<string, unknown> = {}
          if (data.name !== undefined) updateData.name = data.name
          if (data.phone !== undefined) updateData.phone = data.phone
          if (data.village !== undefined) updateData.village = data.village
          if (data.defaultRate !== undefined) updateData.defaultRate = data.defaultRate
          if (data.collectAM !== undefined) updateData.collectAM = data.collectAM
          if (data.collectPM !== undefined) updateData.collectPM = data.collectPM
          if (data.isActive !== undefined) updateData.isActive = data.isActive

          result = await prisma.farmer.update({
            where: { id },
            data: updateData
          })
        } else if (operation === 'delete') {
          let id = data.id as string

          if (id.startsWith('local_') && data.phone) {
            const found = await prisma.farmer.findFirst({
              where: { businessId, phone: data.phone as string }
            })
            if (found) id = found.id
            else { result = { skipped: true, reason: 'Record not found for local ID' }; break }
          }

          result = await prisma.farmer.update({
            where: { id },
            data: { isActive: false }
          })
        }
        break
      }

      case 'customers': {
        if (operation === 'create') {
          const existing = data.phone ? await prisma.customer.findFirst({
            where: { businessId, phone: data.phone as string }
          }) : null

          if (existing) {
            result = existing
            break
          }

          result = await prisma.customer.create({
            data: {
              businessId,
              name: data.name as string,
              phone: (data.phone as string) || null,
              address: (data.address as string) || null,
              defaultRate: data.defaultRate as number,
              subscriptionQtyAM: data.subscriptionQtyAM != null ? (data.subscriptionQtyAM as number) : null,
              subscriptionQtyPM: data.subscriptionQtyPM != null ? (data.subscriptionQtyPM as number) : null,
            }
          })
        } else if (operation === 'update') {
          let id = data.id as string

          // Resolve local_ IDs by looking up by phone
          if (id.startsWith('local_') && data.phone) {
            const found = await prisma.customer.findFirst({
              where: { businessId, phone: data.phone as string }
            })
            if (found) id = found.id
            else { result = { skipped: true, reason: 'Record not found for local ID' }; break }
          }

          const updateData: Record<string, unknown> = {}
          if (data.name !== undefined) updateData.name = data.name
          if (data.phone !== undefined) updateData.phone = data.phone
          if (data.address !== undefined) updateData.address = data.address
          if (data.defaultRate !== undefined) updateData.defaultRate = data.defaultRate
          if (data.subscriptionQtyAM !== undefined) updateData.subscriptionQtyAM = data.subscriptionQtyAM
          if (data.subscriptionQtyPM !== undefined) updateData.subscriptionQtyPM = data.subscriptionQtyPM
          if (data.isActive !== undefined) updateData.isActive = data.isActive

          result = await prisma.customer.update({
            where: { id },
            data: updateData
          })
        } else if (operation === 'delete') {
          let id = data.id as string

          if (id.startsWith('local_') && data.phone) {
            const found = await prisma.customer.findFirst({
              where: { businessId, phone: data.phone as string }
            })
            if (found) id = found.id
            else { result = { skipped: true, reason: 'Record not found for local ID' }; break }
          }

          result = await prisma.customer.update({
            where: { id },
            data: { isActive: false }
          })
        }
        break
      }

      case 'collections': {
        if (operation === 'create') {
          const localId = data.localId as string
          const existing = await prisma.collection.findUnique({ where: { localId } })
          if (existing) {
            result = existing
            break
          }

          const farmer = await prisma.farmer.findFirst({
            where: { id: data.farmerId as string, businessId, isActive: true }
          })
          if (!farmer) {
            return res.status(400).json({ success: false, error: `Farmer not found: ${data.farmerId}` })
          }

          const quantity = data.quantity as number
          const ratePerLiter = data.ratePerLiter as number
          const totalAmount = quantity * ratePerLiter

          result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const collection = await tx.collection.create({
              data: {
                localId,
                businessId,
                farmerId: data.farmerId as string,
                collectedBy: userId,
                date: new Date(data.date as string),
                shift: data.shift as 'MORNING' | 'EVENING',
                quantity,
                fatContent: data.fatContent as number | undefined,
                ratePerLiter,
                totalAmount,
                originalRate: ratePerLiter,
                notes: data.notes as string | undefined,
                syncStatus: 'SYNCED'
              }
            })

            await tx.farmer.update({
              where: { id: data.farmerId as string },
              data: { balance: { increment: totalAmount } }
            })

            return collection
          })
        }
        break
      }

      case 'deliveries': {
        if (operation === 'create') {
          const localId = data.localId as string
          const existing = await prisma.delivery.findUnique({ where: { localId } })
          if (existing) {
            result = existing
            break
          }

          const customer = await prisma.customer.findFirst({
            where: { id: data.customerId as string, businessId, isActive: true }
          })
          if (!customer) {
            return res.status(400).json({ success: false, error: `Customer not found: ${data.customerId}` })
          }

          const quantity = data.quantity as number
          const ratePerLiter = data.ratePerLiter as number
          const totalAmount = quantity * ratePerLiter
          const status = ((data.status as string) || 'DELIVERED') as 'DELIVERED' | 'SKIPPED' | 'CANCELLED'

          result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const delivery = await tx.delivery.create({
              data: {
                localId,
                businessId,
                customerId: data.customerId as string,
                deliveredBy: userId,
                date: new Date(data.date as string),
                shift: data.shift as 'MORNING' | 'EVENING',
                quantity,
                ratePerLiter,
                totalAmount,
                originalRate: ratePerLiter,
                isSubscription: (data.isSubscription as boolean) || false,
                status,
                notes: data.notes as string | undefined,
                syncStatus: 'SYNCED'
              }
            })

            if (status === 'DELIVERED') {
              await tx.customer.update({
                where: { id: data.customerId as string },
                data: { balance: { increment: totalAmount } }
              })
            }

            return delivery
          })
        }
        break
      }

      case 'payments': {
        if (operation === 'create') {
          const localId = data.localId as string
          const existing = await prisma.payment.findUnique({ where: { localId } })
          if (existing) {
            result = existing
            break
          }

          const farmerId = data.farmerId as string | undefined
          const customerId = data.customerId as string | undefined

          if (farmerId) {
            const farmer = await prisma.farmer.findFirst({ where: { id: farmerId, businessId } })
            if (!farmer) {
              return res.status(400).json({ success: false, error: `Farmer not found: ${farmerId}` })
            }
          }
          if (customerId) {
            const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } })
            if (!customer) {
              return res.status(400).json({ success: false, error: `Customer not found: ${customerId}` })
            }
          }

          const amount = data.amount as number

          result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const payment = await tx.payment.create({
              data: {
                localId,
                businessId,
                farmerId: farmerId || null,
                customerId: customerId || null,
                recordedBy: userId,
                date: new Date(data.date as string),
                amount,
                type: data.type as 'PAID_TO_FARMER' | 'RECEIVED_FROM_CUSTOMER' | 'ADVANCE_TO_FARMER' | 'ADVANCE_FROM_CUSTOMER',
                method: ((data.method as string) || 'CASH') as 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER',
                notes: data.notes as string | undefined,
                syncStatus: 'SYNCED'
              }
            })

            if (farmerId) {
              await tx.farmer.update({
                where: { id: farmerId },
                data: { balance: { decrement: amount } }
              })
            }
            if (customerId) {
              await tx.customer.update({
                where: { id: customerId },
                data: { balance: { decrement: amount } }
              })
            }

            return payment
          })
        }
        break
      }
    }

    return res.json({
      success: true,
      data: {
        result,
        serverTime: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Sync push error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to push sync data'
    })
  }
})

// GET /api/sync/status - Get sync status and counts
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const [
      farmerCount,
      customerCount,
      collectionCount,
      deliveryCount,
      paymentCount,
      pendingSyncCount
    ] = await Promise.all([
      prisma.farmer.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.collection.count({ where: { businessId } }),
      prisma.delivery.count({ where: { businessId } }),
      prisma.payment.count({ where: { businessId } }),
      prisma.$transaction([
        prisma.collection.count({ where: { businessId, syncStatus: 'PENDING' } }),
        prisma.delivery.count({ where: { businessId, syncStatus: 'PENDING' } }),
        prisma.payment.count({ where: { businessId, syncStatus: 'PENDING' } })
      ])
    ])

    const serverTime = new Date().toISOString()

    return res.json({
      success: true,
      data: {
        counts: {
          farmers: farmerCount,
          customers: customerCount,
          collections: collectionCount,
          deliveries: deliveryCount,
          payments: paymentCount
        },
        pendingSync: {
          collections: pendingSyncCount[0],
          deliveries: pendingSyncCount[1],
          payments: pendingSyncCount[2]
        },
        serverTime
      }
    })
  } catch (error) {
    console.error('Sync status error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get sync status'
    })
  }
})

export default router
