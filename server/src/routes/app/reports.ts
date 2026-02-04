import { Router, Response } from 'express'
import prisma from '../../lib/prisma.js'
import { authenticateToken, AuthRequest } from '../../middleware/auth.js'

const router = Router()

// GET /api/reports/daily - Daily summary report
router.get('/daily', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { date } = req.query

    const reportDate = date ? new Date(date as string) : new Date()
    reportDate.setHours(0, 0, 0, 0)

    // Get collections for the day
    const collections = await prisma.collection.findMany({
      where: {
        businessId,
        date: reportDate
      },
      include: {
        farmer: {
          select: { id: true, name: true, village: true }
        }
      }
    })

    // Get deliveries for the day
    const deliveries = await prisma.delivery.findMany({
      where: {
        businessId,
        date: reportDate,
        status: 'DELIVERED'
      },
      include: {
        customer: {
          select: { id: true, name: true, address: true }
        }
      }
    })

    // Get payments for the day
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        date: reportDate
      },
      include: {
        farmer: {
          select: { id: true, name: true }
        },
        customer: {
          select: { id: true, name: true }
        }
      }
    })

    // Calculate totals
    const collectionTotals = {
      morning: { liters: 0, amount: 0, count: 0 },
      evening: { liters: 0, amount: 0, count: 0 },
      total: { liters: 0, amount: 0, count: 0 }
    }

    collections.forEach(c => {
      const liters = Number(c.quantity)
      const amount = Number(c.totalAmount)
      collectionTotals.total.liters += liters
      collectionTotals.total.amount += amount
      collectionTotals.total.count++
      if (c.shift === 'MORNING') {
        collectionTotals.morning.liters += liters
        collectionTotals.morning.amount += amount
        collectionTotals.morning.count++
      } else {
        collectionTotals.evening.liters += liters
        collectionTotals.evening.amount += amount
        collectionTotals.evening.count++
      }
    })

    const deliveryTotals = {
      morning: { liters: 0, amount: 0, count: 0 },
      evening: { liters: 0, amount: 0, count: 0 },
      total: { liters: 0, amount: 0, count: 0 }
    }

    deliveries.forEach(d => {
      const liters = Number(d.quantity)
      const amount = Number(d.totalAmount)
      deliveryTotals.total.liters += liters
      deliveryTotals.total.amount += amount
      deliveryTotals.total.count++
      if (d.shift === 'MORNING') {
        deliveryTotals.morning.liters += liters
        deliveryTotals.morning.amount += amount
        deliveryTotals.morning.count++
      } else {
        deliveryTotals.evening.liters += liters
        deliveryTotals.evening.amount += amount
        deliveryTotals.evening.count++
      }
    })

    const paymentTotals = {
      paidToFarmers: 0,
      receivedFromCustomers: 0,
      advanceToFarmers: 0,
      advanceFromCustomers: 0
    }

    payments.forEach(p => {
      const amount = Number(p.amount)
      switch (p.type) {
        case 'PAID_TO_FARMER':
          paymentTotals.paidToFarmers += amount
          break
        case 'RECEIVED_FROM_CUSTOMER':
          paymentTotals.receivedFromCustomers += amount
          break
        case 'ADVANCE_TO_FARMER':
          paymentTotals.advanceToFarmers += amount
          break
        case 'ADVANCE_FROM_CUSTOMER':
          paymentTotals.advanceFromCustomers += amount
          break
      }
    })

    // Daily profit/loss
    const dailyProfit = deliveryTotals.total.amount - collectionTotals.total.amount

    return res.json({
      success: true,
      data: {
        date: reportDate.toISOString().split('T')[0],
        collections: {
          items: collections,
          totals: collectionTotals
        },
        deliveries: {
          items: deliveries,
          totals: deliveryTotals
        },
        payments: {
          items: payments,
          totals: paymentTotals
        },
        summary: {
          totalCollected: collectionTotals.total.liters,
          totalDelivered: deliveryTotals.total.liters,
          collectionAmount: collectionTotals.total.amount,
          deliveryAmount: deliveryTotals.total.amount,
          dailyProfit,
          netCashFlow: paymentTotals.receivedFromCustomers - paymentTotals.paidToFarmers
        }
      }
    })
  } catch (error) {
    console.error('Daily report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate daily report'
    })
  }
})

// GET /api/reports/farmer-dues - Farmer dues report
router.get('/farmer-dues', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const farmers = await prisma.farmer.findMany({
      where: {
        businessId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        village: true,
        balance: true,
        _count: {
          select: { collections: true, payments: true }
        }
      },
      orderBy: { balance: 'desc' }
    })

    // Get totals
    const totalDues = farmers.reduce((sum, f) => sum + Number(f.balance), 0)
    const farmersWithDues = farmers.filter(f => Number(f.balance) > 0)
    const farmersWithCredit = farmers.filter(f => Number(f.balance) < 0)

    return res.json({
      success: true,
      data: {
        farmers: farmers.map(f => ({
          ...f,
          balance: Number(f.balance)
        })),
        summary: {
          totalFarmers: farmers.length,
          farmersWithDues: farmersWithDues.length,
          farmersWithCredit: farmersWithCredit.length,
          totalDues,
          totalCredit: Math.abs(farmersWithCredit.reduce((sum, f) => sum + Number(f.balance), 0))
        }
      }
    })
  } catch (error) {
    console.error('Farmer dues report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate farmer dues report'
    })
  }
})

// GET /api/reports/customer-dues - Customer dues report
router.get('/customer-dues', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        balance: true,
        _count: {
          select: { deliveries: true, payments: true }
        }
      },
      orderBy: { balance: 'desc' }
    })

    // Get totals
    const totalDues = customers.reduce((sum, c) => sum + Number(c.balance), 0)
    const customersWithDues = customers.filter(c => Number(c.balance) > 0)
    const customersWithCredit = customers.filter(c => Number(c.balance) < 0)

    return res.json({
      success: true,
      data: {
        customers: customers.map(c => ({
          ...c,
          balance: Number(c.balance)
        })),
        summary: {
          totalCustomers: customers.length,
          customersWithDues: customersWithDues.length,
          customersWithCredit: customersWithCredit.length,
          totalDues,
          totalCredit: Math.abs(customersWithCredit.reduce((sum, c) => sum + Number(c.balance), 0))
        }
      }
    })
  } catch (error) {
    console.error('Customer dues report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate customer dues report'
    })
  }
})

// GET /api/reports/collections - Collections report for date range
router.get('/collections', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { from, to, farmerId } = req.query

    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30))
    const toDate = to ? new Date(to as string) : new Date()
    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      businessId,
      date: {
        gte: fromDate,
        lte: toDate
      }
    }

    if (farmerId && typeof farmerId === 'string') {
      where.farmerId = farmerId
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        farmer: {
          select: { id: true, name: true, village: true }
        }
      },
      orderBy: { date: 'desc' }
    })

    // Group by farmer
    const byFarmer: Record<string, { name: string; village: string | null; liters: number; amount: number; count: number }> = {}
    collections.forEach(c => {
      if (!byFarmer[c.farmerId]) {
        byFarmer[c.farmerId] = {
          name: c.farmer.name,
          village: c.farmer.village,
          liters: 0,
          amount: 0,
          count: 0
        }
      }
      byFarmer[c.farmerId].liters += Number(c.quantity)
      byFarmer[c.farmerId].amount += Number(c.totalAmount)
      byFarmer[c.farmerId].count++
    })

    // Group by date
    const byDate: Record<string, { liters: number; amount: number; count: number }> = {}
    collections.forEach(c => {
      const dateKey = c.date.toISOString().split('T')[0]
      if (!byDate[dateKey]) {
        byDate[dateKey] = { liters: 0, amount: 0, count: 0 }
      }
      byDate[dateKey].liters += Number(c.quantity)
      byDate[dateKey].amount += Number(c.totalAmount)
      byDate[dateKey].count++
    })

    const totals = collections.reduce(
      (acc, c) => ({
        liters: acc.liters + Number(c.quantity),
        amount: acc.amount + Number(c.totalAmount),
        count: acc.count + 1
      }),
      { liters: 0, amount: 0, count: 0 }
    )

    return res.json({
      success: true,
      data: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        collections,
        byFarmer: Object.entries(byFarmer).map(([id, data]) => ({ id, ...data })),
        byDate: Object.entries(byDate).map(([date, data]) => ({ date, ...data })),
        totals
      }
    })
  } catch (error) {
    console.error('Collections report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate collections report'
    })
  }
})

// GET /api/reports/deliveries - Deliveries report for date range
router.get('/deliveries', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { from, to, customerId } = req.query

    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30))
    const toDate = to ? new Date(to as string) : new Date()
    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(23, 59, 59, 999)

    const where: Record<string, unknown> = {
      businessId,
      date: {
        gte: fromDate,
        lte: toDate
      },
      status: 'DELIVERED'
    }

    if (customerId && typeof customerId === 'string') {
      where.customerId = customerId
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, address: true }
        }
      },
      orderBy: { date: 'desc' }
    })

    // Group by customer
    const byCustomer: Record<string, { name: string; address: string | null; liters: number; amount: number; count: number }> = {}
    deliveries.forEach(d => {
      if (!byCustomer[d.customerId]) {
        byCustomer[d.customerId] = {
          name: d.customer.name,
          address: d.customer.address,
          liters: 0,
          amount: 0,
          count: 0
        }
      }
      byCustomer[d.customerId].liters += Number(d.quantity)
      byCustomer[d.customerId].amount += Number(d.totalAmount)
      byCustomer[d.customerId].count++
    })

    // Group by date
    const byDate: Record<string, { liters: number; amount: number; count: number }> = {}
    deliveries.forEach(d => {
      const dateKey = d.date.toISOString().split('T')[0]
      if (!byDate[dateKey]) {
        byDate[dateKey] = { liters: 0, amount: 0, count: 0 }
      }
      byDate[dateKey].liters += Number(d.quantity)
      byDate[dateKey].amount += Number(d.totalAmount)
      byDate[dateKey].count++
    })

    const totals = deliveries.reduce(
      (acc, d) => ({
        liters: acc.liters + Number(d.quantity),
        amount: acc.amount + Number(d.totalAmount),
        count: acc.count + 1
      }),
      { liters: 0, amount: 0, count: 0 }
    )

    return res.json({
      success: true,
      data: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        deliveries,
        byCustomer: Object.entries(byCustomer).map(([id, data]) => ({ id, ...data })),
        byDate: Object.entries(byDate).map(([date, data]) => ({ date, ...data })),
        totals
      }
    })
  } catch (error) {
    console.error('Deliveries report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate deliveries report'
    })
  }
})

// GET /api/reports/profit-loss - Profit/Loss report for date range
router.get('/profit-loss', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { from, to } = req.query

    const fromDate = from ? new Date(from as string) : new Date(new Date().setDate(new Date().getDate() - 30))
    const toDate = to ? new Date(to as string) : new Date()
    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(23, 59, 59, 999)

    // Get collections (expenses)
    const collections = await prisma.collection.findMany({
      where: {
        businessId,
        date: {
          gte: fromDate,
          lte: toDate
        }
      }
    })

    // Get deliveries (revenue)
    const deliveries = await prisma.delivery.findMany({
      where: {
        businessId,
        date: {
          gte: fromDate,
          lte: toDate
        },
        status: 'DELIVERED'
      }
    })

    // Get payments
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        date: {
          gte: fromDate,
          lte: toDate
        }
      }
    })

    // Calculate totals
    const totalCollectionAmount = collections.reduce((sum, c) => sum + Number(c.totalAmount), 0)
    const totalCollectionLiters = collections.reduce((sum, c) => sum + Number(c.quantity), 0)
    const avgBuyRate = totalCollectionLiters > 0 ? totalCollectionAmount / totalCollectionLiters : 0

    const totalDeliveryAmount = deliveries.reduce((sum, d) => sum + Number(d.totalAmount), 0)
    const totalDeliveryLiters = deliveries.reduce((sum, d) => sum + Number(d.quantity), 0)
    const avgSellRate = totalDeliveryLiters > 0 ? totalDeliveryAmount / totalDeliveryLiters : 0

    const grossProfit = totalDeliveryAmount - totalCollectionAmount
    const profitMargin = totalDeliveryAmount > 0 ? (grossProfit / totalDeliveryAmount) * 100 : 0

    // Payment summary
    const paidToFarmers = payments
      .filter(p => p.type === 'PAID_TO_FARMER')
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const receivedFromCustomers = payments
      .filter(p => p.type === 'RECEIVED_FROM_CUSTOMER')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Daily breakdown
    const dailyData: Record<string, { date: string; collected: number; delivered: number; profit: number }> = {}

    collections.forEach(c => {
      const dateKey = c.date.toISOString().split('T')[0]
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, collected: 0, delivered: 0, profit: 0 }
      }
      dailyData[dateKey].collected += Number(c.totalAmount)
    })

    deliveries.forEach(d => {
      const dateKey = d.date.toISOString().split('T')[0]
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, collected: 0, delivered: 0, profit: 0 }
      }
      dailyData[dateKey].delivered += Number(d.totalAmount)
    })

    Object.values(dailyData).forEach(day => {
      day.profit = day.delivered - day.collected
    })

    return res.json({
      success: true,
      data: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        collections: {
          count: collections.length,
          liters: totalCollectionLiters,
          amount: totalCollectionAmount,
          avgRate: avgBuyRate
        },
        deliveries: {
          count: deliveries.length,
          liters: totalDeliveryLiters,
          amount: totalDeliveryAmount,
          avgRate: avgSellRate
        },
        payments: {
          paidToFarmers,
          receivedFromCustomers,
          netCashFlow: receivedFromCustomers - paidToFarmers
        },
        profit: {
          grossProfit,
          profitMargin,
          rateSpread: avgSellRate - avgBuyRate
        },
        dailyBreakdown: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))
      }
    })
  } catch (error) {
    console.error('Profit/Loss report error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate profit/loss report'
    })
  }
})

export default router
