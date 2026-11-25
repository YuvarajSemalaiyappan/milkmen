# Customer app plan

A small, separate app (and web page) where a milkman's **customers** see their own milk account:
deliveries, bills, dues and payments. Written 25 Nov 2026 from the current code and the live database.

Status: **plan only, nothing built yet.**

## Goal and scope

Version 1 is **read-only**. A customer can:

- see this month's deliveries day by day (AM/PM, litres, rate, amount, skipped days)
- see the bill for any month and what is still pending, month by month (same numbers the milkman's
  dues reminder sends)
- see payments made and the current balance
- share a bill as an image (reuses the "receipt as image" work, see the end)
- switch between milkmen if they buy from more than one

Not in version 1: pausing or changing quantity, paying online, chat. Those change the milkman's
delivery round and need an approval step, so they come later (see Phase 4).

## Can the current setup handle it?

Yes for load, no for login and security. Numbers from the live database (25 Nov 2026):

| | Today |
|---|---|
| Database size | 21 MB |
| Customers | ~430 with a phone number, 385 active, across 4 businesses |
| Same phone at two businesses | 0 (but the design must allow it) |
| Same phone twice in one business | 0 (blocked by `@@unique([businessId, phone])`) |
| Requests over 2 s in the last 14 days | 8, none over 3 s |

Customers read a bill a few times a month, far less than milkmen entering collections twice a day,
so the server and database are not the limit. Deliveries and payments are already indexed by
`(customerId, date)`, so "my month" is a cheap query.

What is missing is below, in the order it has to happen.

## Phase 0: fix token checks (done, 25 Nov 2026)

`authenticateToken` used to verify only the JWT signature, so a refresh token worked as an access
token, and a token without `businessId` would have passed with `where: { businessId: undefined }`
(which Prisma treats as no filter: every business).

Now access tokens carry `type: 'access'`, and `verifyAccessToken()` in `middleware/auth.ts` accepts
only that type with a `userId` and `businessId`; `middleware/plan.ts` uses the same function.
Refresh, admin, old untyped and (future) customer tokens get 401. The apps refresh once on that 401
(refresh tokens are unchanged and `/auth/refresh` already checked their type), so nobody was logged out.
Customer tokens must use their own type and their own middleware.

## Phase 1: server for customers

### Login: PIN set by the milkman

SMS codes cost money per message and WhatsApp codes need the WhatsApp API (ruled out), so:

- The milkman turns on app access for a customer from the customer's page (both apps): the server
  makes a random 4-digit PIN, shows it once, and the milkman shares it (WhatsApp text, existing button).
- The customer logs in with **phone + PIN** and must change the PIN on first login (like staff `mustChangePin`).
- "Forgot PIN" = ask the milkman to reset it.

### Data model

One login per phone number, linked to each business's customer row with that phone, so a person
buying from two milkmen has one login:

```prisma
model CustomerLogin {
  id            String    @id @default(cuid())
  phone         String    @unique
  pinHash       String
  mustChangePin Boolean   @default(true)
  failedCount   Int       @default(0)
  lockedUntil   DateTime?
  lastLogin     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// on Customer:
  appAccess Boolean @default(false)   // milkman switched it on
```

Which businesses a login sees = `Customer` rows with that phone, `appAccess = true` and `isActive = true`
(uses the existing `phone` column; add `@@index([phone])` on `Customer`). If two businesses each give
access, the customer sees both and picks one.

### Tokens

- Separate `type: 'customer'` tokens with `{ loginId, phone }`. The business and customer ids are
  **not** in the token: each request names the `customerId` and the server checks it belongs to that
  phone with `appAccess`. Turning access off then works at once.
- New middleware `authenticateCustomer` (only `type: 'customer'`). Customer routes live under
  `/api/customer/*` and never reuse staff handlers.

### Endpoints (all read-only, all bounded)

| Endpoint | Returns |
|---|---|
| `POST /api/customer/auth/login` | tokens + list of businesses (name, customerId) |
| `POST /api/customer/auth/refresh` | new access token |
| `PUT /api/customer/auth/pin` | change PIN |
| `GET /api/customer/:customerId/summary` | business name and phone, balance, this month's totals |
| `GET /api/customer/:customerId/deliveries?month=YYYY-MM` | that month's deliveries only |
| `GET /api/customer/:customerId/bills?months=6` | pending by month (same logic as `/reports/customer-pending/:id`) |
| `GET /api/customer/:customerId/payments?limit=20` | latest payments |

Follow `RULES.md` performance rules: one month or a `limit` per call, totals in SQL, `select` only shown
fields. Reuse the dues and pending logic from `routes/app/reports.ts` by moving it into `lib/` so the
staff and customer endpoints share one copy.

### Staff side (both apps, parity rule)

- Customer page: "App access" switch, "Reset PIN" (shows the new PIN once), "Share login" (WhatsApp
  text with the app link, phone and PIN).
- Server: `POST /api/customers/:id/app-access` (on/off) and `POST /api/customers/:id/reset-app-pin`,
  owner or manager only. These are saves, so the plan guard applies: a milkman without an active plan
  can't give new access.

## Phase 2: security and hosting

1. **Rate limiting** (none today). On customer and staff login: per phone, 5 wrong PINs → locked
   15 minutes (`failedCount` / `lockedUntil` in the database, so it survives restarts), plus a per-IP
   limit with `express-rate-limit`. A 4-digit PIN without this can be guessed.
2. **Plan expiry:** customers keep **read-only** access when their milkman's plan lapses (their bills
   are theirs), but the milkman can't turn on access for new customers.
3. **Hosting:** the server is on Render's free plan, kept awake by a cron ping. Fine for a few
   milkmen; customers expect the app to open instantly, so move to a paid instance before launch.
   The server and the Neon database are both in the US. Moving both to an Indian region (Neon and
   the host must match) would cut every request's time from India. Do this as its own step and
   measure before and after.
4. The in-memory plan cache (`middleware/plan.ts`) assumes one server process. If the server is ever
   scaled to several instances, move it to the database or Redis.
5. Log customer logins and failures in `RequestLog` like everything else (already automatic for 4xx/5xx).

## Phase 3: the customer app

- **Separate app**, not a mode in the milkman app: smaller, simpler, its own Play Store listing
  ("Milkmen – My Milk Account"), and no staff screens shipped to customers.
- Same stack as `milkmen-app` (Expo, Expo Router, react-query, i18next with Tamil and English), in a
  new repo. Screens: Login → Change PIN → pick milkman (if more than one) → Home (balance, this month)
  → Month (day-by-day) → Bills → Payments → Settings (language, change PIN, log out).
- A web version for customers without the app (same endpoints) can follow; the PWA in this repo is a
  good base.
- Share bill as image: same receipt card as the milkman's "send as image".

## Phase 4: later (needs the milkman to approve)

- Pause deliveries for dates / change quantity → shows up as a request on the milkman's Deliver tab;
  only an approved request changes the round.
- Online payment (UPI) → needs a payment gateway and reconciliation; separate plan.

## Order of work

1. ~~Phase 0 token fix~~ (done).
2. Rate limiting + lockout (helps staff login too).
3. `CustomerLogin` migration, staff "App access / Reset PIN" in both apps.
4. Customer endpoints.
5. Customer app (Android first), then Play Store listing.
6. Paid hosting before inviting customers; region move measured separately.

## Open questions for the owner

- Should customers see the rate per litre, or only amounts?
- Should skipped days show to the customer?
- Is the customer app free for customers and included in the milkman's plan, or a paid add-on?
