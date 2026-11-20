import { Router, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma.js'
import { authenticateToken, requireOwner, requireOwnerOrManager, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// Validation schemas
const createRouteSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional()
})

const updateRouteSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional()
})

const assignUsersSchema = z.object({
  userIds: z.array(z.string())
})

const assignFarmersSchema = z.object({
  farmerIds: z.array(z.string()),
  sortOrders: z.record(z.string(), z.number()).optional(),
  areaIds: z.record(z.string(), z.string()).optional()
})

const assignCustomersSchema = z.object({
  customerIds: z.array(z.string()),
  sortOrders: z.record(z.string(), z.number()).optional(),
  areaIds: z.record(z.string(), z.string()).optional()
})

// Helper to check if user has access to route. One round trip: the role, the route and the
// staff assignment are read in parallel.
async function userHasRouteAccess(userId: string, routeId: string, businessId: string): Promise<boolean> {
  const [user, route, assigned] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.route.findFirst({ where: { id: routeId, businessId }, select: { id: true } }),
    prisma.userRoute.findFirst({ where: { userId, routeId }, select: { id: true } })
  ])
  if (!route) return false
  // Owners and managers can access all routes in business; staff only their assigned routes
  return user?.role === 'OWNER' || user?.role === 'MANAGER' || !!assigned
}

// Adds people to a route or updates their order/area, without removing anyone, in two statements
// however many people are sent. sortOrder/areaId are only changed for people that have a value.
async function upsertRouteMembers(
  table: 'RouteFarmer' | 'RouteCustomer',
  routeId: string,
  ids: string[],
  sortOrders?: Record<string, number>,
  areaIds?: Record<string, string>
) {
  const col = Prisma.raw(table === 'RouteFarmer' ? '"farmerId"' : '"customerId"')
  const tbl = Prisma.raw(`"${table}"`)
  const orders = ids.map((id) => sortOrders?.[id] ?? null)
  const areas = ids.map((id) => areaIds?.[id] ?? null)
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE ${tbl} AS t SET
        "sortOrder" = COALESCE(v.sort_order, t."sortOrder"),
        "areaId" = COALESCE(v.area_id, t."areaId")
      FROM unnest(${ids}::text[], ${orders}::int[], ${areas}::text[]) AS v(member_id, sort_order, area_id)
      WHERE t."routeId" = ${routeId} AND t.${col} = v.member_id
        AND (v.sort_order IS NOT NULL OR v.area_id IS NOT NULL)`,
    prisma.$executeRaw`
      INSERT INTO ${tbl} (id, "routeId", ${col}, "sortOrder", "areaId", "createdAt")
      SELECT gen_random_uuid()::text, ${routeId}, v.member_id, COALESCE(v.sort_order, (v.ord - 1)::int), v.area_id, NOW()
      FROM unnest(${ids}::text[], ${orders}::int[], ${areas}::text[]) WITH ORDINALITY AS v(member_id, sort_order, area_id, ord)
      ON CONFLICT ("routeId", ${col}) DO NOTHING`
  ])
}

// GET /api/routes - List routes (filtered by role)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, userId } = req.user!
    const { active } = req.query

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    let routes

    if (user?.role === 'OWNER' || user?.role === 'MANAGER') {
      // Owners/Managers see all routes
      const where: Record<string, unknown> = { businessId }
      if (active === 'true') {
        where.isActive = true
      } else if (active === 'false') {
        where.isActive = false
      }

      routes = await prisma.route.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              userRoutes: true,
              routeFarmers: true,
              routeCustomers: true
            }
          }
        }
      })
    } else {
      // Staff only sees assigned routes
      const where: Record<string, unknown> = {
        route: { businessId }
      }
      if (active === 'true') {
        where.route = { ...where.route as object, isActive: true }
      }

      const userRoutes = await prisma.userRoute.findMany({
        where: {
          userId,
          ...where
        },
        include: {
          route: {
            include: {
              _count: {
                select: {
                  userRoutes: true,
                  routeFarmers: true,
                  routeCustomers: true
                }
              }
            }
          }
        },
        orderBy: { route: { name: 'asc' } }
      })
      routes = userRoutes.map(ur => ur.route)
    }

    return res.json({
      success: true,
      data: routes
    })
  } catch (error) {
    console.error('List routes error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch routes'
    })
  }
})

// GET /api/routes/:id - Get route with members
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, userId } = req.user!
    const id = req.params.id as string

    // Check access
    const hasAccess = await userHasRouteAccess(userId, id, businessId)
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this route'
      })
    }

    // scope=1: only the areas and who is on the route in which area. Used by the route filter on
    // the entry screens, which needs nothing else.
    if (req.query.scope === '1') {
      const [routeFarmers, routeCustomers, areas] = await Promise.all([
        prisma.routeFarmer.findMany({ where: { routeId: id }, select: { farmerId: true, areaId: true } }),
        prisma.routeCustomer.findMany({ where: { routeId: id }, select: { customerId: true, areaId: true } }),
        prisma.area.findMany({
          where: { routeId: id, isActive: true },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' }
        })
      ])
      return res.json({ success: true, data: { id, routeFarmers, routeCustomers, areas } })
    }

    const route = await prisma.route.findFirst({
      where: { id, businessId },
      include: {
        userRoutes: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, role: true, isActive: true }
            }
          }
        },
        routeFarmers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            farmer: {
              select: { id: true, name: true, phone: true, village: true, defaultRate: true, collectAM: true, collectPM: true, subscriptionQtyAM: true, subscriptionQtyPM: true, isActive: true, balance: true }
            }
          }
        },
        routeCustomers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            customer: {
              select: { id: true, name: true, phone: true, address: true, defaultRate: true, subscriptionQtyAM: true, subscriptionQtyPM: true, isActive: true, balance: true }
            }
          }
        },
        areas: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { routeFarmers: true, routeCustomers: true } }
          }
        }
      }
    })

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    return res.json({
      success: true,
      data: route
    })
  } catch (error) {
    console.error('Get route error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch route'
    })
  }
})

// POST /api/routes - Create route (Owner/Manager)
router.post('/', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const validation = createRouteSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    const { name, description } = validation.data

    // Check for duplicate name within business
    const existing = await prisma.route.findFirst({
      where: { businessId, name }
    })
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A route with this name already exists'
      })
    }

    const route = await prisma.route.create({
      data: {
        businessId,
        name,
        description
      }
    })

    return res.status(201).json({
      success: true,
      data: route
    })
  } catch (error) {
    console.error('Create route error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create route'
    })
  }
})

// PUT /api/routes/:id - Update route (Owner/Manager)
router.put('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string
    const validation = updateRouteSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Check route exists and belongs to business
    const existing = await prisma.route.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    const { name } = validation.data

    // Check for duplicate name if changing
    if (name && name !== existing.name) {
      const duplicate = await prisma.route.findFirst({
        where: { businessId, name, id: { not: id } }
      })
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'A route with this name already exists'
        })
      }
    }

    const route = await prisma.route.update({
      where: { id },
      data: validation.data
    })

    return res.json({
      success: true,
      data: route
    })
  } catch (error) {
    console.error('Update route error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update route'
    })
  }
})

// DELETE /api/routes/:id - Delete route (Owner/Manager)
router.delete('/:id', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const id = req.params.id as string

    const existing = await prisma.route.findFirst({
      where: { id, businessId }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    // Delete route (cascade will delete assignments)
    await prisma.route.delete({
      where: { id }
    })

    return res.json({
      success: true,
      message: 'Route deleted successfully'
    })
  } catch (error) {
    console.error('Delete route error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete route'
    })
  }
})

// POST /api/routes/:id/users - Assign users to route (Owner only)
router.post('/:id/users', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const validation = assignUsersSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    const { userIds } = validation.data

    // Verify all users belong to business
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, businessId },
      select: { id: true }
    })
    if (users.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some users not found'
      })
    }

    // Replace all user assignments (delete existing, create new)
    await prisma.$transaction([
      prisma.userRoute.deleteMany({ where: { routeId } }),
      prisma.userRoute.createMany({
        data: userIds.map(userId => ({ userId, routeId }))
      })
    ])

    return res.json({
      success: true,
      message: 'Users assigned successfully'
    })
  } catch (error) {
    console.error('Assign users error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to assign users'
    })
  }
})

// DELETE /api/routes/:id/users/:userId - Remove user from route (Owner only)
router.delete('/:id/users/:userId', authenticateToken, requireOwner, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const userId = req.params.userId as string

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    await prisma.userRoute.deleteMany({
      where: { routeId, userId }
    })

    return res.json({
      success: true,
      message: 'User removed from route'
    })
  } catch (error) {
    console.error('Remove user error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to remove user'
    })
  }
})

// POST /api/routes/:id/farmers - Assign farmers to route (Owner/Manager)
router.post('/:id/farmers', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const validation = assignFarmersSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    const { farmerIds, sortOrders, areaIds } = validation.data

    // Verify all farmers belong to business
    const farmers = await prisma.farmer.findMany({
      where: { id: { in: farmerIds }, businessId },
      select: { id: true }
    })
    if (farmers.length !== farmerIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some farmers not found'
      })
    }

    // Upsert farmer assignments (add or update without removing existing)
    await upsertRouteMembers('RouteFarmer', routeId, farmerIds, sortOrders, areaIds)

    return res.json({
      success: true,
      message: 'Farmers assigned successfully'
    })
  } catch (error) {
    console.error('Assign farmers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to assign farmers'
    })
  }
})

// DELETE /api/routes/:id/farmers/:farmerId - Remove farmer from route (Owner/Manager)
router.delete('/:id/farmers/:farmerId', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const farmerId = req.params.farmerId as string

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    await prisma.routeFarmer.deleteMany({
      where: { routeId, farmerId }
    })

    return res.json({
      success: true,
      message: 'Farmer removed from route'
    })
  } catch (error) {
    console.error('Remove farmer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to remove farmer'
    })
  }
})

// POST /api/routes/:id/customers - Assign customers to route (Owner/Manager)
router.post('/:id/customers', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const validation = assignCustomersSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      })
    }

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    const { customerIds, sortOrders, areaIds } = validation.data

    // Verify all customers belong to business
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, businessId },
      select: { id: true }
    })
    if (customers.length !== customerIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some customers not found'
      })
    }

    // Upsert customer assignments (add or update without removing existing)
    await upsertRouteMembers('RouteCustomer', routeId, customerIds, sortOrders, areaIds)

    return res.json({
      success: true,
      message: 'Customers assigned successfully'
    })
  } catch (error) {
    console.error('Assign customers error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to assign customers'
    })
  }
})

// DELETE /api/routes/:id/customers/:customerId - Remove customer from route (Owner/Manager)
router.delete('/:id/customers/:customerId', authenticateToken, requireOwnerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const routeId = req.params.id as string
    const customerId = req.params.customerId as string

    // Verify route exists
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      })
    }

    await prisma.routeCustomer.deleteMany({
      where: { routeId, customerId }
    })

    return res.json({
      success: true,
      message: 'Customer removed from route'
    })
  } catch (error) {
    console.error('Remove customer error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to remove customer'
    })
  }
})

export default router
