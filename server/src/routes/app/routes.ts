import { Router, Response } from 'express'
import { z } from 'zod'
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
  sortOrders: z.record(z.string(), z.number()).optional()
})

const assignCustomersSchema = z.object({
  customerIds: z.array(z.string()),
  sortOrders: z.record(z.string(), z.number()).optional()
})

// Helper to check if user has access to route
async function userHasRouteAccess(userId: string, routeId: string, businessId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })

  // Owners and managers can access all routes in business
  if (user?.role === 'OWNER' || user?.role === 'MANAGER') {
    const route = await prisma.route.findFirst({
      where: { id: routeId, businessId }
    })
    return !!route
  }

  // Staff can only access assigned routes
  const userRoute = await prisma.userRoute.findFirst({
    where: { userId, routeId, route: { businessId } }
  })
  return !!userRoute
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
              select: { id: true, name: true, phone: true, village: true, defaultRate: true, isActive: true, balance: true }
            }
          }
        },
        routeCustomers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            customer: {
              select: { id: true, name: true, phone: true, address: true, defaultRate: true, isActive: true, balance: true }
            }
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
      where: { id: { in: userIds }, businessId }
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

    const { farmerIds, sortOrders } = validation.data

    // Verify all farmers belong to business
    const farmers = await prisma.farmer.findMany({
      where: { id: { in: farmerIds }, businessId }
    })
    if (farmers.length !== farmerIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some farmers not found'
      })
    }

    // Replace all farmer assignments
    await prisma.$transaction([
      prisma.routeFarmer.deleteMany({ where: { routeId } }),
      prisma.routeFarmer.createMany({
        data: farmerIds.map((farmerId, index) => ({
          routeId,
          farmerId,
          sortOrder: sortOrders?.[farmerId] ?? index
        }))
      })
    ])

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

    const { customerIds, sortOrders } = validation.data

    // Verify all customers belong to business
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, businessId }
    })
    if (customers.length !== customerIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some customers not found'
      })
    }

    // Replace all customer assignments
    await prisma.$transaction([
      prisma.routeCustomer.deleteMany({ where: { routeId } }),
      prisma.routeCustomer.createMany({
        data: customerIds.map((customerId, index) => ({
          routeId,
          customerId,
          sortOrder: sortOrders?.[customerId] ?? index
        }))
      })
    ])

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
