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
