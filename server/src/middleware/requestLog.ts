import { AsyncLocalStorage } from 'node:async_hooks'
import type { NextFunction, Request, Response } from 'express'
import prisma from '../lib/prisma.js'

// Every API request prints one JSON line (method, route, status, time, user) to stdout, which
// Render keeps in its log view. Failed requests (status >= 400) and slow ones are also saved in
// the RequestLog table, with the error message, so failures can be audited later.

const SLOW_MS = 2000
const KEEP_DAYS = 90
const MAX_ERROR = 1000

interface RequestContext {
  error?: string
}

const context = new AsyncLocalStorage<RequestContext>()

// Route handlers report failures with console.error('...', error). Keep the first error thrown
// inside the current request so the log row says what actually went wrong, not just "500".
const originalConsoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const ctx = context.getStore()
  if (ctx && !ctx.error) {
    const err = args.find((a) => a instanceof Error) as (Error & { code?: string }) | undefined
    if (err) {
      const where = err.stack?.split('\n').slice(1, 3).map((l) => l.trim()).join(' < ') ?? ''
      ctx.error = `${err.code ? `${err.code} ` : ''}${err.name}: ${err.message} @ ${where}`
    } else {
      ctx.error = args.map(String).join(' ')
    }
  }
  originalConsoleError(...args)
}

function describeBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const b = body as { error?: unknown; code?: unknown; details?: unknown }
  let text = typeof b.error === 'string' ? b.error : undefined
  if (typeof b.code === 'string') text = `${b.code}: ${text ?? ''}`
  // Zod validation issues: keep only the field path and message
  if (Array.isArray(b.details)) {
    const issues = b.details
      .slice(0, 5)
      .map((d: { path?: unknown[]; message?: string }) => `${(d.path ?? []).join('.')}: ${d.message ?? ''}`)
      .join('; ')
    text = `${text ?? ''} [${issues}]`
  }
  return text
}

export function requestLog(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) return next()

  const started = process.hrtime.bigint()
  const ctx: RequestContext = {}
  let bodyError: string | undefined

  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    if (res.statusCode >= 400) bodyError = describeBody(body)
    return json(body)
  }

  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n)
    const user = (req as Request & { user?: { userId?: string; businessId?: string } }).user
    const admin = (req as Request & { admin?: { adminId?: string } }).admin
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.baseUrl || req.path
    const path = req.originalUrl.split('?')[0]
    const status = res.statusCode
    const error = [bodyError, ctx.error].filter(Boolean).join(' | ').slice(0, MAX_ERROR) || undefined

    process.stdout.write(
      JSON.stringify({
        t: 'req',
        m: req.method,
        r: route,
        s: status,
        ms: durationMs,
        u: user?.userId ?? admin?.adminId,
        b: user?.businessId,
        ...(error ? { e: error } : {})
      }) + '\n'
    )

    if (status >= 400 || durationMs >= SLOW_MS) {
      prisma.requestLog
        .create({
          data: {
            method: req.method,
            route,
            path: path.slice(0, 300),
            status,
            durationMs,
            userId: user?.userId ?? admin?.adminId ?? null,
            businessId: user?.businessId ?? null,
            error: error ?? (status >= 400 ? null : 'slow')
          }
        })
        .catch((e: unknown) => originalConsoleError('Request log write failed:', e))
    }
  })

  context.run(ctx, next)
}

// Prune old rows once a day. The interval does not keep the process alive.
export function startRequestLogCleanup() {
  const prune = () =>
    prisma.requestLog
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } })
      .catch((e: unknown) => originalConsoleError('Request log cleanup failed:', e))
  setTimeout(prune, 60_000).unref()
  setInterval(prune, 24 * 60 * 60 * 1000).unref()
}

// Errors that happen outside a request (a dropped database connection, a promise nobody awaited,
// a crash) never reach the request logger. Save them in the same table with method PROCESS, so
// one place shows everything that went wrong. Also records each server start, to spot restarts.
export function logServerEvent(event: string, error?: unknown, status = 500) {
  const err = error as (Error & { code?: string }) | undefined
  const message = err
    ? `${err.code ? `${err.code} ` : ''}${err.name ?? 'Error'}: ${err.message ?? String(error)} @ ${
        err.stack?.split('\n').slice(1, 3).map((l) => l.trim()).join(' < ') ?? ''
      }`.slice(0, MAX_ERROR)
    : null
  process.stdout.write(JSON.stringify({ t: 'event', r: event, s: status, ...(message ? { e: message } : {}) }) + '\n')
  return prisma.requestLog
    .create({
      data: { method: 'PROCESS', route: event, path: '-', status, durationMs: 0, error: message }
    })
    .catch((e: unknown) => originalConsoleError('Event log write failed:', e))
}

export function installProcessErrorLogging() {
  process.on('unhandledRejection', (reason) => {
    originalConsoleError('Unhandled promise rejection:', reason)
    void logServerEvent('unhandledRejection', reason)
  })
  process.on('uncaughtException', (error) => {
    originalConsoleError('Uncaught exception:', error)
    // The process may be in a broken state: save the error, then exit so Render restarts it
    const exit = () => process.exit(1)
    setTimeout(exit, 3000).unref()
    void logServerEvent('uncaughtException', error).finally(exit)
  })
}
