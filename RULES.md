# Project Rules

## Commit Rules
- Use simple, single-line commit messages
- Do not include Co-Authored-By in commits
- ALWAYS run `npm ci && npm run build:render` before every commit

## Pre-Commit Checklist
1. Run `npm ci && npm run build:render`
2. If build fails, fix the issue before committing
3. This catches deployment issues locally before they fail in production

## Performance Rules (every endpoint)

The API must stay fast with 10+ businesses and 5+ years of data per business
(millions of collection/delivery rows). The server and database are far apart, so every
database round trip costs network time. Check every new or changed endpoint against these rules.

1. **Fixed number of queries per request.** Never run a query inside a loop over rows or
   request items. Use `IN (...)`, `createMany`, `deleteMany`, or one SQL statement over
   `unnest(...)` arrays (see `bulk-update` in `deliveries.ts`, `upsertRouteMembers` in `routes.ts`).
   Independent queries run in parallel with `Promise.all`.
2. **Every list is bounded.** A list grows with time: give it a date range, a `take`/`limit`,
   or both. Never return a person's or a business's whole history. Use `order=asc&limit=1`
   to find a first entry instead of loading everything.
3. **Totals and groupings are computed in the database** (`SUM`/`COUNT`/`GROUP BY`, `groupBy`,
   `aggregate`), never by loading rows into Node and reducing them. Reports send rows only when
   the client lists them (`rows=0` turns them off).
4. **Select only what the clients use.** Use `select` on relations; no `include: { x: true }`
   of whole rows, no embedded history lists, no `_count` the apps don't show.
   Create/update responses don't include relations nobody reads.
5. **Count only when asked.** `count(*)` over years of rows is slow; list endpoints count only
   when the client sends `page` (`wantsTotal` in `lib/db.ts`).
6. **Every filter has an index.** Each `where` must start with indexed columns, normally
   `businessId` or a person id followed by `date` (and `shift`). Add the index in the same
   migration as the query, and check the plan with `EXPLAIN ANALYZE` on a Neon branch.
7. **Check ownership in the write itself.** `updateMany({ where: { id, businessId } })` and a
   `count === 0` check replace a separate "does it exist" lookup.
8. **Money and stock changes run in one transaction with a lock.** Creates take
   `lockEntrySlot` for the person + date + shift (or person, for payments); edits and deletes
   read the row with `lockOwnedRow` (SELECT ... FOR UPDATE) inside the transaction, so two
   saves at once cannot double a balance.
9. **Failures are logged.** Every handler's `catch` calls `console.error('<what> error:', error)`;
   the request logger saves the route, status, time, user and error to `RequestLog`
   (read with `GET /api/admin/logs`). Requests slower than 2 s are saved too: check them.
   Errors outside a request (dropped database connections, unhandled promise rejections, crashes)
   and every server start are saved with method `PROCESS`. `GET /health/db` returns 503 when the
   database doesn't answer: point an uptime monitor at it, since nothing can be logged then.

## App Parity Rule (web <-> phone app)

The web app (`apps/mobile-web`, this repo) and the phone app (`YuvarajSemalaiyappan/milkmen-app`)
are two front ends for the same business. **Any change to how one behaves must be made in the
other in the same piece of work**, unless it is listed as platform-only below.

- This covers features, screens, fields, validation, business rules (what is paid, duplicates,
  skips, balances), wording in `en.json`/`ta.json`, and how each screen calls the server.
- Business rules live on the server where possible (e.g. `GET /payments/period`), so both apps
  get them from one place instead of two copies.
- Server changes must keep both apps working: check what each app reads before removing a field,
  and deploy the server before releasing an app that depends on it.
- If the other app can't be changed right away, add the gap to "Known differences" below (and in
  the app repo's `AGENTS.md`) in the same commit, so nothing is forgotten.

Platform-only (no parity needed): fingerprint lock and on-phone reminder notifications (phone app);
install/offline PWA behaviour (web).

### Known differences (fix these to match)
- None right now.

Dues reports (both apps): a month (this month by default) and the route/area filter. Each row
shows the running balance, with what was delivered/collected and paid in the month
(`GET /reports/*-dues?from&to&routeId&areaId`). Customer dues also has "Didn't pay in <month>"
(`GET /reports/customer-unpaid?month&routeId&areaId`: owed at month end, last paid, owes now).
Dues reminders (WhatsApp/SMS) list the pending amount by month, most recent first, from
`GET /reports/customer-pending/:id` (the balance is matched to the latest months' bills first;
the rest is "Earlier").

Not a difference: the web's Collections, Deliveries and Payments round pages load the full route
because they show the route's people with their details; screens that only filter by route use
`GET /routes/:id?scope=1` in both apps.
