import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const connectionString = process.env.DATABASE_URL!

// Create PostgreSQL connection pool
// Keep connections open between requests: opening a new TLS connection to the database costs
// several network round trips, which the default 10-second idle timeout paid on most requests.
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 5 * 60 * 1000,
  keepAlive: true
})

// Create Prisma adapter
// A pooled connection dropped by the database (e.g. Neon suspending when idle) is reported here.
// The pool replaces it on the next query; the event is saved so repeated drops are visible.
// Imported lazily to avoid a circular import with the request logger.
const adapter = new PrismaPg(pool, {
  onPoolError: (err: Error) => {
    void import('../middleware/requestLog.js').then((m) => m.logServerEvent('db-pool-error', err, 503))
  }
})

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
