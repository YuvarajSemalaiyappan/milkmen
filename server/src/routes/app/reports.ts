import { Router, Response } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma.js'
import { dayRange, ymd } from '../../lib/db.js'
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

// Totals for one group of entries, as plain numbers
interface Group {
  liters: number
  amount: number
  count: number
}
const sumGroups = (groups: Group[]): Group =>
  groups.reduce((a, g) => ({ liters: a.liters + g.liters, amount: a.amount + g.amount, count: a.count + g.count }), {
    liters: 0,
    amount: 0,
    count: 0
  })

// GET /api/reports/farmer-dues - Farmer dues report (balances are kept on the farmer row)
router.get('/farmer-dues', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const farmers = await prisma.farmer.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, phone: true, village: true, balance: true },
      orderBy: { balance: 'desc' }
    })

    const rows = farmers.map((f) => ({ ...f, balance: Number(f.balance) }))
    const withDues = rows.filter((f) => f.balance > 0)
    const withCredit = rows.filter((f) => f.balance < 0)

    return res.json({
      success: true,
      data: {
        farmers: rows,
        summary: {
          totalFarmers: rows.length,
          farmersWithDues: withDues.length,
          farmersWithCredit: withCredit.length,
          totalDues: rows.reduce((sum, f) => sum + f.balance, 0),
          totalCredit: Math.abs(withCredit.reduce((sum, f) => sum + f.balance, 0))
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

// GET /api/reports/customer-dues - Customer dues report (balances are kept on the customer row)
router.get('/customer-dues', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    const customers = await prisma.customer.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, phone: true, address: true, balance: true },
      orderBy: { balance: 'desc' }
    })

    const rows = customers.map((c) => ({ ...c, balance: Number(c.balance) }))
    const withDues = rows.filter((c) => c.balance > 0)
    const withCredit = rows.filter((c) => c.balance < 0)

    return res.json({
      success: true,
      data: {
        customers: rows,
        summary: {
          totalCustomers: rows.length,
          customersWithDues: withDues.length,
          customersWithCredit: withCredit.length,
          totalDues: rows.reduce((sum, c) => sum + c.balance, 0),
          totalCredit: Math.abs(withCredit.reduce((sum, c) => sum + c.balance, 0))
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

// GET /api/reports/collections - Collections report for a date range.
// Totals and groupings are computed in the database. The entry rows are included for the web
// app's list view; pass rows=0 to get only the totals (the phone app does).
router.get('/collections', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { from, to, farmerId, rows } = req.query
    const { fromDate, toDate } = dayRange(from, to)
    const person = typeof farmerId === 'string' && farmerId ? farmerId : null
    const filter = Prisma.sql`c."businessId" = ${businessId}
      AND c.date BETWEEN ${ymd(fromDate)}::date AND ${ymd(toDate)}::date
      ${person ? Prisma.sql`AND c."farmerId" = ${person}` : Prisma.empty}`

    const [byFarmer, byDate, collections] = await Promise.all([
      prisma.$queryRaw<(Group & { id: string; name: string; village: string | null })[]>`
        SELECT c."farmerId" AS id, f.name, f.village,
          SUM(c.quantity)::float8 AS liters, SUM(c."totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Collection" c JOIN "Farmer" f ON f.id = c."farmerId"
        WHERE ${filter}
        GROUP BY c."farmerId", f.name, f.village ORDER BY liters DESC`,
      prisma.$queryRaw<(Group & { date: string })[]>`
        SELECT to_char(c.date, 'YYYY-MM-DD') AS date,
          SUM(c.quantity)::float8 AS liters, SUM(c."totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Collection" c
        WHERE ${filter}
        GROUP BY c.date ORDER BY c.date DESC`,
      rows === '0'
        ? Promise.resolve([])
        : prisma.collection.findMany({
            where: {
              businessId,
              date: { gte: fromDate, lte: toDate },
              ...(person ? { farmerId: person } : {})
            },
            include: { farmer: { select: { id: true, name: true, village: true } } },
            orderBy: { date: 'desc' }
          })
    ])

    return res.json({
      success: true,
      data: {
        from: ymd(fromDate),
        to: ymd(toDate),
        collections,
        byFarmer,
        byDate,
        totals: sumGroups(byDate)
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

// GET /api/reports/deliveries - Deliveries report for a date range (delivered only).
// Same shape and rows=0 option as the collections report.
router.get('/deliveries', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { from, to, customerId, rows } = req.query
    const { fromDate, toDate } = dayRange(from, to)
    const person = typeof customerId === 'string' && customerId ? customerId : null
    const filter = Prisma.sql`d."businessId" = ${businessId}
      AND d.date BETWEEN ${ymd(fromDate)}::date AND ${ymd(toDate)}::date
      AND d.status = 'DELIVERED'
      ${person ? Prisma.sql`AND d."customerId" = ${person}` : Prisma.empty}`

    const [byCustomer, byDate, deliveries] = await Promise.all([
      prisma.$queryRaw<(Group & { id: string; name: string; address: string | null })[]>`
        SELECT d."customerId" AS id, cu.name, cu.address,
          SUM(d.quantity)::float8 AS liters, SUM(d."totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Delivery" d JOIN "Customer" cu ON cu.id = d."customerId"
        WHERE ${filter}
        GROUP BY d."customerId", cu.name, cu.address ORDER BY liters DESC`,
      prisma.$queryRaw<(Group & { date: string })[]>`
        SELECT to_char(d.date, 'YYYY-MM-DD') AS date,
          SUM(d.quantity)::float8 AS liters, SUM(d."totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Delivery" d
        WHERE ${filter}
        GROUP BY d.date ORDER BY d.date DESC`,
      rows === '0'
        ? Promise.resolve([])
        : prisma.delivery.findMany({
            where: {
              businessId,
              date: { gte: fromDate, lte: toDate },
              status: 'DELIVERED',
              ...(person ? { customerId: person } : {})
            },
            include: { customer: { select: { id: true, name: true, address: true } } },
            orderBy: { date: 'desc' }
          })
    ])

    return res.json({
      success: true,
      data: {
        from: ymd(fromDate),
        to: ymd(toDate),
        deliveries,
        byCustomer,
        byDate,
        totals: sumGroups(byDate)
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

// GET /api/reports/profit-loss - Profit/Loss report for a date range, computed in the database
router.get('/profit-loss', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const { fromDate, toDate } = dayRange(req.query.from, req.query.to)
    const fromDay = ymd(fromDate)
    const toDay = ymd(toDate)

    const [collectedByDay, deliveredByDay, paymentsByType] = await Promise.all([
      prisma.$queryRaw<(Group & { date: string })[]>`
        SELECT to_char(date, 'YYYY-MM-DD') AS date,
          SUM(quantity)::float8 AS liters, SUM("totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Collection"
        WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date
        GROUP BY date`,
      prisma.$queryRaw<(Group & { date: string })[]>`
        SELECT to_char(date, 'YYYY-MM-DD') AS date,
          SUM(quantity)::float8 AS liters, SUM("totalAmount")::float8 AS amount, COUNT(*)::int AS count
        FROM "Delivery"
        WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date AND status = 'DELIVERED'
        GROUP BY date`,
      prisma.payment.groupBy({
        by: ['type'],
        where: { businessId, date: { gte: fromDate, lte: toDate } },
        _sum: { amount: true }
      })
    ])

    const collected = sumGroups(collectedByDay)
    const delivered = sumGroups(deliveredByDay)
    const avgBuyRate = collected.liters > 0 ? collected.amount / collected.liters : 0
    const avgSellRate = delivered.liters > 0 ? delivered.amount / delivered.liters : 0
    const grossProfit = delivered.amount - collected.amount
    const profitMargin = delivered.amount > 0 ? (grossProfit / delivered.amount) * 100 : 0
    const paid = (type: string) => Number(paymentsByType.find((p) => p.type === type)?._sum.amount ?? 0)
    const paidToFarmers = paid('PAID_TO_FARMER')
    const receivedFromCustomers = paid('RECEIVED_FROM_CUSTOMER')

    // Daily breakdown
    const dailyData: Record<string, { date: string; collected: number; delivered: number; profit: number }> = {}
    const day = (date: string) => (dailyData[date] ??= { date, collected: 0, delivered: 0, profit: 0 })
    collectedByDay.forEach((c) => (day(c.date).collected += c.amount))
    deliveredByDay.forEach((d) => (day(d.date).delivered += d.amount))
    Object.values(dailyData).forEach((d) => (d.profit = d.delivered - d.collected))

    return res.json({
      success: true,
      data: {
        from: fromDay,
        to: toDay,
        collections: { count: collected.count, liters: collected.liters, amount: collected.amount, avgRate: avgBuyRate },
        deliveries: { count: delivered.count, liters: delivered.liters, amount: delivered.amount, avgRate: avgSellRate },
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
