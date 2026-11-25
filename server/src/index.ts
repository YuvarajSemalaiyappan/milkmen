import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
dotenv.config()

// Import routes
import authRoutes from './routes/app/auth.js'
import setupRoutes from './routes/admin/setup.js'
import farmerRoutes from './routes/app/farmers.js'
import customerRoutes from './routes/app/customers.js'
import collectionRoutes from './routes/app/collections.js'
import deliveryRoutes from './routes/app/deliveries.js'
import paymentRoutes from './routes/app/payments.js'
import reportRoutes from './routes/app/reports.js'
import settingsRoutes from './routes/app/settings.js'
import ratesRoutes from './routes/app/rates.js'
import routesRoutes from './routes/app/routes.js'
import areasRoutes from './routes/app/areas.js'
import accountRoutes from './routes/app/account.js'
import adminAuthRoutes from './routes/admin/auth.js'
import adminDashboardRoutes from './routes/admin/dashboard.js'
import adminBusinessesRoutes from './routes/admin/businesses.js'
import adminSubscriptionsRoutes from './routes/admin/subscriptions.js'
import adminLogsRoutes from './routes/admin/logs.js'
import adminDeletionRequestsRoutes from './routes/admin/deletionRequests.js'
import prisma from './lib/prisma.js'
import { requireActivePlan } from './middleware/plan.js'
import { installProcessErrorLogging, logServerEvent, requestLog, startRequestLogCleanup } from './middleware/requestLog.js'

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(requestLog)
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'https://localhost:5173', 'https://localhost:5174', 'https://localhost:5175'],
  credentials: true
}))
app.use(express.json())

// Health check (server only: does not touch the database, so it doesn't keep the database awake)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Database health check for an uptime monitor: 200 when the database answers, 503 when it doesn't.
// When the database is down nothing can be saved to RequestLog, so this is how that case is noticed.
app.get('/health/db', async (_req, res) => {
  const started = Date.now()
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database did not answer in 10 s')), 10_000))
    ])
    res.json({ status: 'ok', db: 'ok', ms: Date.now() - started })
  } catch (error) {
    console.error('Database health check failed:', error)
    res.status(503).json({ status: 'error', db: 'unreachable', ms: Date.now() - started })
  }
})

// API Routes
app.use('/api/setup', setupRoutes)
app.use('/api/auth', authRoutes)
// Saves need an active plan (reads and login always work): see middleware/plan.ts
app.use(
  ['/api/farmers', '/api/customers', '/api/collections', '/api/deliveries', '/api/payments', '/api/reports',
    '/api/settings', '/api/rates', '/api/routes', '/api/areas'],
  requireActivePlan
)
app.use('/api/farmers', farmerRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/collections', collectionRoutes)
app.use('/api/deliveries', deliveryRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/rates', ratesRoutes)
app.use('/api/routes', routesRoutes)
app.use('/api/areas', areasRoutes)
// Account deletion requests: outside the plan guard, so an expired business can still ask
app.use('/api/account', accountRoutes)

// Admin Routes
app.use('/api/admin/auth', adminAuthRoutes)
app.use('/api/admin/dashboard', adminDashboardRoutes)
app.use('/api/admin/businesses', adminBusinessesRoutes)
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes)
app.use('/api/admin/logs', adminLogsRoutes)
app.use('/api/admin/deletion-requests', adminDeletionRequestsRoutes)

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  // Admin panel — served under /admin
  const adminDist = path.join(__dirname, '../../apps/admin-panel/dist')
  app.use('/admin', express.static(adminDist))
  // Admin SPA fallback — serve admin index.html for /admin/* non-API routes
  app.use('/admin/*splat', (_req, res) => {
    res.sendFile('index.html', { root: adminDist })
  })

  // Mobile web — served at root
  const clientDist = path.join(__dirname, '../../apps/mobile-web/dist')
  app.use(express.static(clientDist))
  // SPA fallback — serve index.html for non-API routes
  app.use((_req, res, next) => {
    if (_req.path.startsWith('/api') || _req.path === '/health') {
      return next()
    }
    res.sendFile('index.html', { root: clientDist })
  })
}

// 404 handler (API routes only)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  })
})

// Start server
installProcessErrorLogging()
startRequestLogCleanup()
void logServerEvent('server-start', undefined, 200)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
