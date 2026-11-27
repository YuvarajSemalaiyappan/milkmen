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

## Subscription (plan) Rules

- A plan is active when its status is `ACTIVE` and its end date is in the future. The stored status
  only changes when the admin acts, so always use `effectiveStatus()` from `server/src/lib/plan.ts`
  (an `ACTIVE` plan past its end date counts as `EXPIRED`) in API responses and admin filters.
- Without an active plan a business can log in and read everything, but every POST/PUT/PATCH/DELETE on
  the app API is refused with **402** and `code` `PLAN_EXPIRED`, `PLAN_SUSPENDED` or `PLAN_INACTIVE`
  (`server/src/middleware/plan.ts`). Changing one's own profile or PIN stays open.
- The guard caches each business's plan for a minute; admin plan actions call `clearPlanCache()`
  so a renewal works on the next save. Add that call to any new code that changes a plan.
- Both apps show the 402 message in the user's language (`plan.*` here, `app.plan*` in the phone app)
  and show the plan state on the dashboard / Home.

## App Parity Rule (web <-> phone app)

The web app (`apps/mobile-web`, this repo) and the phone app (`YuvarajSemalaiyappan/milkmen-app`)
are two front ends for the same business. **Any change to how one behaves must be made in the
other in the same piece of work**, unless it is listed as platform-only below.

- This covers features, screens, fields, validation, business rules (what is paid, duplicates,
  skips, balances), wording in `en.json`/`ta.json`, and how each screen calls the server.
- Business rules live on the server where possible (e.g. `GET /payments/period`), so both apps
  get them from one place instead of two copies.
- What is paid is decided only by `server/src/lib/paid.ts`: an entry is paid when a payment period
  covers its date and shift and it existed when that payment was recorded. Lists return `isPaid` with
  `paid=1`; `/payments/summary` returns unpaid totals, advance/pending (gaps under ₹1 count as settled)
  and `paidTill`; `/payments/calendar?month` gives paid/unpaid by day and shift for the calendar on the
  farmer and customer pages. The apps never keep their own copy of this rule.
- `Business.settledBefore`: entries dated before it count as paid and can't be moved (old history
  cleared, balances untouched). Set to 1 Apr 2026 for Magizhl Milk by migration.
- Regular payments (`RECEIVED_FROM_CUSTOMER`, `PAID_TO_FARMER`) must have a full period; only advances may
  have none (zod check on `POST /payments` and the database CHECK `Payment_period_required`).
  A period never ends before it starts (CHECK `Payment_period_order`). If a regular payment's period ends
  before it starts and starts at the default start (nothing is due), `POST /payments` saves it as an
  advance with no period; any other backwards period is refused (400 `BAD_PERIOD`). `/payments/period`
  returns `nothingDue` and both payment screens show it.
- Server changes must keep both apps working: check what each app reads before removing a field,
  and deploy the server before releasing an app that depends on it.
- If the other app can't be changed right away, add the gap to "Known differences" below (and in
  the app repo's `AGENTS.md`) in the same commit, so nothing is forgotten.

Platform-only (no parity needed): fingerprint lock and on-phone reminder notifications (phone app);
install/offline PWA behaviour (web).

### Known differences (fix these to match)
- Map pins (phone app only for now, owner's choice): farmers and customers have `latitude`, `longitude`,
  `locationAccuracy` and `landmark`, set from the phone (GPS or dragging a pin; anyone in the business).
  The phone shows them on the delivery round / collect map with a Navigate button (Google Maps link).
  The web app has no map yet; its forms don't send these fields, so saving there keeps the pin.

Dues reports (both apps): a month (this month by default) and the route/area filter. Each row
shows the running balance, with what was delivered/collected and paid in the month
(`GET /reports/*-dues?from&to&routeId&areaId`). Customer dues also has "Didn't pay in <month>"
(`GET /reports/customer-unpaid?month&routeId&areaId`: owed at month end, last paid, owes now).
Dues reminders (WhatsApp/SMS) list the pending amount by month, most recent first, from
`GET /reports/customer-pending/:id` (the balance is matched to the latest months' bills first;
the rest is "Earlier").

Advance and pending (both apps): `GET /payments/summary?customerId|farmerId` returns the unpaid entries
over the whole history, the balance, and the gap between them. `advance` = paid more than the entries of
the periods paid for (or an advance payment), taken off the next payment; `pending` = paid less, added to
the next payment. `GET /payments/period` returns the same `advance`/`pending`; the payment screen shows
"To pay" = period total − advance + pending and warns before saving an amount that doesn't match.
Detail pages take their unpaid totals from the summary, not from the listed rows.

Not a difference: the web's Collections, Deliveries and Payments round pages load the full route
because they show the route's people with their details; screens that only filter by route use
`GET /routes/:id?scope=1` in both apps.

## Account deletion and privacy (Google Play)

- Both apps: Settings → Delete account sends a request (`POST /api/account/deletion-request`, can be withdrawn
  with DELETE). Nothing is deleted automatically. `/api/account` is outside the plan guard on purpose.
- Public pages in the web app, no sign-in: `/privacy` (privacy policy, `features/legal/PrivacyPolicyPage.tsx`;
  update its effective date when the text changes) and `/delete-account` (form → `POST /api/account/deletion-request/public`,
  rate-limited per address). These URLs go in the Play Console listing.
- Admin panel → Deletion requests: delete the business (owner) or the login (staff), then mark the request Done.
  The `DeletionRequest` row has no foreign keys, so it stays as the record that the request was handled.
- If the privacy policy's facts change (new data collected, new service provider, analytics), update the page.
