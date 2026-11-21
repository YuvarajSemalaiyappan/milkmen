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


// Per-person totals for a date range, for the dues reports: what was collected/delivered and what
// was paid in the range. Two grouped queries, whatever the size of the range.
type PeriodTotals = Map<string, { liters: number; amount: number; paid: number }>
async function duesPeriodTotals(kind: 'farmer' | 'customer', businessId: string, from: unknown, to: unknown): Promise<PeriodTotals | null> {
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) return null
  const { fromDate, toDate } = dayRange(from, to)
  const fromDay = ymd(fromDate)
  const toDay = ymd(toDate)
  const [entries, paid] = await Promise.all([
    kind === 'farmer'
      ? prisma.$queryRaw<{ id: string; liters: number; amount: number }[]>`
          SELECT "farmerId" AS id, SUM(quantity)::float8 AS liters, SUM("totalAmount")::float8 AS amount
          FROM "Collection" WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date
          GROUP BY "farmerId"`
      : prisma.$queryRaw<{ id: string; liters: number; amount: number }[]>`
          SELECT "customerId" AS id, SUM(quantity)::float8 AS liters, SUM("totalAmount")::float8 AS amount
          FROM "Delivery" WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date
            AND status = 'DELIVERED'
          GROUP BY "customerId"`,
    kind === 'farmer'
      ? prisma.$queryRaw<{ id: string; paid: number }[]>`
          SELECT "farmerId" AS id, SUM(amount)::float8 AS paid
          FROM "Payment" WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date
            AND "farmerId" IS NOT NULL
          GROUP BY "farmerId"`
      : prisma.$queryRaw<{ id: string; paid: number }[]>`
          SELECT "customerId" AS id, SUM(amount)::float8 AS paid
          FROM "Payment" WHERE "businessId" = ${businessId} AND date BETWEEN ${fromDay}::date AND ${toDay}::date
            AND "customerId" IS NOT NULL
          GROUP BY "customerId"`
  ])
  const totals: PeriodTotals = new Map()
  for (const e of entries) totals.set(e.id, { liters: e.liters, amount: e.amount, paid: 0 })
  for (const p of paid) totals.set(p.id, { ...(totals.get(p.id) ?? { liters: 0, amount: 0 }), paid: p.paid })
  return totals
}
const noPeriod = { liters: 0, amount: 0, paid: 0 }


// Optional route/area filter for people lists: only those on the route (and in the area)
function routeWhere(routeId: unknown, areaId: unknown) {
  if (typeof routeId !== 'string' || !routeId) return {}
  return {
    routes: { some: { routeId, ...(typeof areaId === 'string' && areaId ? { areaId } : {}) } }
  }
}

const monthRe = /^\d{4}-\d{2}$/
// First and last day (YYYY-MM-DD) of a YYYY-MM month
function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` }
}

// GET /api/reports/customer-unpaid?month=YYYY-MM&routeId&areaId
// "Customers who did not pay in <month>": everyone who owed money at the end of the month and made
// no payment during it, largest first. dueAtMonthEnd is worked back from today's balance (minus
// later deliveries, plus later payments); lastPaid is the latest payment up to the month end;
// paidSince is what they paid after it; dueNow is today's balance. One query over indexed lookups
// per customer, so it stays fast with years of data.
router.get('/customer-unpaid', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const q = req.query as Record<string, string | undefined>
    const month = q.month && monthRe.test(q.month) ? q.month : new Date().toISOString().slice(0, 7)
    const { start, end } = monthBounds(month)
    const routeFilter = q.routeId
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM "RouteCustomer" rc WHERE rc."customerId" = c.id AND rc."routeId" = ${q.routeId}
          ${q.areaId ? Prisma.sql`AND rc."areaId" = ${q.areaId}` : Prisma.empty})`
      : Prisma.empty

    const rows = await prisma.$queryRaw<
      {
        id: string
        name: string
        phone: string | null
        isActive: boolean
        route: string | null
        dueNow: number
        laterSales: number
        paidSince: number
        paidInMonth: boolean
        lastPaid: string | null
        monthSales: number
      }[]
    >`
      SELECT c.id, c.name, c.phone, c."isActive", rt.name AS route,
        c.balance::float8 AS "dueNow",
        later.s AS "laterSales", since.s AS "paidSince", inm.paid AS "paidInMonth",
        lp.d AS "lastPaid", ms.s AS "monthSales"
      FROM "Customer" c
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(d."totalAmount"), 0)::float8 AS s FROM "Delivery" d
        WHERE d."customerId" = c.id AND d.status = 'DELIVERED' AND d.date > ${end}::date) later ON true
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(p.amount), 0)::float8 AS s FROM "Payment" p
        WHERE p."customerId" = c.id AND p.date > ${end}::date) since ON true
      LEFT JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM "Payment" p
        WHERE p."customerId" = c.id AND p.date BETWEEN ${start}::date AND ${end}::date) AS paid) inm ON true
      LEFT JOIN LATERAL (SELECT to_char(MAX(p.date), 'YYYY-MM-DD') AS d FROM "Payment" p
        WHERE p."customerId" = c.id AND p.date <= ${end}::date) lp ON true
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(d."totalAmount"), 0)::float8 AS s FROM "Delivery" d
        WHERE d."customerId" = c.id AND d.status = 'DELIVERED' AND d.date BETWEEN ${start}::date AND ${end}::date) ms ON true
      LEFT JOIN LATERAL (SELECT r.name FROM "RouteCustomer" rc JOIN "Route" r ON r.id = rc."routeId"
        WHERE rc."customerId" = c.id ORDER BY r.name LIMIT 1) rt ON true
      WHERE c."businessId" = ${businessId} ${routeFilter}`

    const unpaid = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        isActive: r.isActive,
        route: r.route,
        dueAtMonthEnd: Math.round((r.dueNow - r.laterSales + r.paidSince) * 100) / 100,
        monthSales: r.monthSales,
        lastPaid: r.lastPaid,
        paidSince: r.paidSince,
        dueNow: r.dueNow,
        paidInMonth: r.paidInMonth
      }))
      .filter((r) => r.dueAtMonthEnd > 0.005 && !r.paidInMonth)
      .sort((a, b) => b.dueAtMonthEnd - a.dueAtMonthEnd)
      .map(({ paidInMonth: _paid, ...r }) => r)

    return res.json({
      success: true,
      data: {
        month,
        monthStart: start,
        monthEnd: end,
        customers: unpaid,
        summary: {
          customers: unpaid.length,
          dueAtMonthEnd: unpaid.reduce((s, r) => s + r.dueAtMonthEnd, 0),
          paidSince: unpaid.filter((r) => r.paidSince > 0).length,
          stillOwing: unpaid.filter((r) => r.dueNow > 0.005).length
        }
      }
    })
  } catch (error) {
    console.error('Customer unpaid report error:', error)
    return res.status(500).json({ success: false, error: 'Failed to generate unpaid customers report' })
  }
})

// GET /api/reports/customer-pending/:id - What one customer owes, split by month, most recent first.
// Today's balance is set against their most recent monthly bills first (payments clear the oldest
// bills), so the months always add up to the balance. Anything beyond all bills is "earlier".
router.get('/customer-pending/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!
    const customer = await prisma.customer.findFirst({
      where: { id: String(req.params.id), businessId },
      select: { id: true, name: true, balance: true }
    })
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' })

    const balance = Number(customer.balance)
    const months: { month: string; amount: number; billed: number }[] = []
    let remaining = Math.round(balance * 100) / 100
    if (remaining > 0) {
      const bills = await prisma.$queryRaw<{ month: string; billed: number }[]>`
        SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, SUM("totalAmount")::float8 AS billed
        FROM "Delivery"
        WHERE "businessId" = ${businessId} AND "customerId" = ${customer.id} AND status = 'DELIVERED'
        GROUP BY 1 ORDER BY 1 DESC`
      for (const b of bills) {
        if (remaining <= 0.005) break
        const amount = Math.min(b.billed, remaining)
        months.push({ month: b.month, amount: Math.round(amount * 100) / 100, billed: b.billed })
        remaining = Math.round((remaining - amount) * 100) / 100
      }
    }

    return res.json({
      success: true,
      data: { id: customer.id, name: customer.name, balance, months, earlier: remaining > 0.005 ? remaining : 0 }
    })
  } catch (error) {
    console.error('Customer pending months error:', error)
    return res.status(500).json({ success: false, error: 'Failed to split pending by month' })
  }
})

// GET /api/reports/farmer-dues - Farmer dues report (balances are kept on the farmer row)
router.get('/farmer-dues', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.user!

    // balance is the running balance kept on the farmer. With from/to, each row also gets
    // `period`: liters and amount collected and amount paid in that range.
    const [farmers, period] = await Promise.all([
      prisma.farmer.findMany({
        where: { businessId, isActive: true, ...routeWhere(req.query.routeId, req.query.areaId) },
        select: { id: true, name: true, phone: true, village: true, balance: true },
        orderBy: { balance: 'desc' }
      }),
      duesPeriodTotals('farmer', businessId, req.query.from, req.query.to)
    ])

    const rows = farmers.map((f) => ({
      ...f,
      balance: Number(f.balance),
      ...(period ? { period: period.get(f.id) ?? noPeriod } : {})
    }))
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

    // balance is the running balance kept on the customer. With from/to, each row also gets
    // `period`: liters and amount delivered and amount paid in that range.
    const [customers, period] = await Promise.all([
      prisma.customer.findMany({
        where: { businessId, isActive: true, ...routeWhere(req.query.routeId, req.query.areaId) },
        select: { id: true, name: true, phone: true, address: true, balance: true },
        orderBy: { balance: 'desc' }
      }),
      duesPeriodTotals('customer', businessId, req.query.from, req.query.to)
    ])

    const rows = customers.map((c) => ({
      ...c,
      balance: Number(c.balance),
      ...(period ? { period: period.get(c.id) ?? noPeriod } : {})
    }))
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
