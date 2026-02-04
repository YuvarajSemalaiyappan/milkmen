# milkmen - Milk Collection & Sales Management PWA

## Project Overview

A Progressive Web App for milkmen to manage their daily milk collection from farmers and sales to town customers. The app must work offline in rural areas and support multi-language (English & Tamil).

### Business Model
- Milkman purchases milk from multiple farmers (varying rates based on fat content)
- Sells to town customers (subscription-based with flexible purchases)
- Tracks payments, dues, and credits on both sides
- Generates reports for accounting and reconciliation

---

## Tech Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: Tailwind CSS + Headless UI (lightweight, offline-friendly)
- **State Management**: Zustand (simple, works well with offline)
- **PWA**: Vite PWA plugin with Workbox
- **Offline Storage**: IndexedDB via Dexie.js
- **i18n**: react-i18next (English + Tamil)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts (for reports)

### Backend
- **Runtime**: Node.js with Express or Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **API**: REST (simpler offline sync than GraphQL)

### Infrastructure
- **Hosting**: Any cloud (AWS/GCP/DigitalOcean)
- **Database**: Managed PostgreSQL
- **File Storage**: S3-compatible for receipts/exports

---

## Database Schema

### Multi-tenancy Model
```
Business (tenant)
├── Users (staff members)
├── Farmers (suppliers)
├── Customers (buyers)
├── Collections (daily purchases from farmers)
├── Deliveries (daily sales to customers)
├── Payments (tracks money flow)
└── Settings (rates, preferences)
```

### Core Tables

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Multi-tenant: Each business is isolated
model Business {
  id          String   @id @default(cuid())
  name        String
  phone       String   @unique
  address     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  users       User[]
  farmers     Farmer[]
  customers   Customer[]
  collections Collection[]
  deliveries  Delivery[]
  payments    Payment[]
  rates       Rate[]
}

model User {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  name        String
  phone       String
  pin         String   // 4-digit PIN for quick login
  role        Role     @default(STAFF)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  collections Collection[]
  deliveries  Delivery[]
  payments    Payment[]
  farmerSortOrders   UserFarmerOrder[]
  customerSortOrders UserCustomerOrder[]
  
  @@unique([businessId, phone])
}

enum Role {
  OWNER
  MANAGER
  STAFF
}

model Farmer {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  name        String
  phone       String?
  village     String?
  defaultRate Decimal  @db.Decimal(6, 2) // Default rate per liter (set during creation)
  isActive    Boolean  @default(true)
  balance     Decimal  @default(0) @db.Decimal(10, 2) // Positive = we owe them
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  collections Collection[]
  payments    Payment[]
  rates       Rate[]
  sortOrders  UserFarmerOrder[]
  
  @@unique([businessId, phone])
  @@index([businessId, isActive])
}

// User-specific sort order for farmers (for route optimization)
model UserFarmerOrder {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  farmerId    String
  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  sortOrder   Int      // Lower number = higher in list
  
  @@unique([userId, farmerId])
  @@index([userId, sortOrder])
}

model Customer {
  id              String   @id @default(cuid())
  businessId      String
  business        Business @relation(fields: [businessId], references: [id])
  
  name            String
  phone           String?
  address         String?
  defaultRate     Decimal  @db.Decimal(6, 2) // Default rate per liter (set during creation)
  
  // Subscription (optional)
  subscriptionQty Decimal? @db.Decimal(5, 2) // Default daily quantity
  subscriptionAM  Boolean  @default(true)    // Morning delivery
  subscriptionPM  Boolean  @default(false)   // Evening delivery
  
  isActive        Boolean  @default(true)
  balance         Decimal  @default(0) @db.Decimal(10, 2) // Positive = they owe us
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  deliveries      Delivery[]
  payments        Payment[]
  sortOrders      UserCustomerOrder[]
  
  @@unique([businessId, phone])
  @@index([businessId, isActive])
}

// User-specific sort order for customers (for delivery route optimization)
model UserCustomerOrder {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  shift       Shift?   // Optional: separate sort order for AM vs PM
  sortOrder   Int      // Lower number = higher in list
  
  @@unique([userId, customerId, shift])
  @@index([userId, shift, sortOrder])
}

// Fat-based pricing
model Rate {
  id          String   @id @default(cuid())
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  farmerId    String?  // If null, it's the default business rate
  farmer      Farmer?  @relation(fields: [farmerId], references: [id])
  
  fatFrom     Decimal  @db.Decimal(3, 1) // e.g., 3.0
  fatTo       Decimal  @db.Decimal(3, 1) // e.g., 4.0
  ratePerLiter Decimal @db.Decimal(6, 2) // e.g., 45.00
  
  effectiveFrom DateTime @default(now())
  effectiveTo   DateTime?
  
  createdAt   DateTime @default(now())
  
  @@index([businessId, farmerId, effectiveFrom])
}

model Collection {
  id          String   @id @default(cuid())
  
  // Offline sync fields
  localId     String?  @unique // Client-generated ID for offline
  syncStatus  SyncStatus @default(SYNCED)
  
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  farmerId    String
  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  
  collectedBy String
  user        User     @relation(fields: [collectedBy], references: [id])
  
  date        DateTime @db.Date
  shift       Shift    @default(MORNING)
  
  quantity    Decimal  @db.Decimal(6, 2) // Liters
  fatContent  Decimal? @db.Decimal(3, 1) // Fat percentage
  ratePerLiter Decimal @db.Decimal(6, 2) // ACTUAL rate for THIS collection (may differ from farmer's default)
  totalAmount Decimal  @db.Decimal(10, 2)
  
  // Rate edit tracking
  rateEditedAt   DateTime? // When was rate last edited (null = never edited, used default)
  rateEditedBy   String?   // Who edited the rate (user ID)
  originalRate   Decimal?  @db.Decimal(6, 2) // Original rate before any edits (for audit)
  
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([businessId, date])
  @@index([farmerId, date])
}

model Delivery {
  id          String   @id @default(cuid())
  
  // Offline sync fields
  localId     String?  @unique
  syncStatus  SyncStatus @default(SYNCED)
  
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  
  deliveredBy String
  user        User     @relation(fields: [deliveredBy], references: [id])
  
  date        DateTime @db.Date
  shift       Shift    @default(MORNING)
  
  quantity    Decimal  @db.Decimal(6, 2)
  ratePerLiter Decimal @db.Decimal(6, 2) // ACTUAL rate for THIS delivery (may differ from customer's default)
  totalAmount Decimal  @db.Decimal(10, 2)
  
  // Rate edit tracking
  rateEditedAt   DateTime? // When was rate edited (null = used default)
  originalRate   Decimal?  @db.Decimal(6, 2) // Original rate before edit (for audit)
  
  isSubscription Boolean @default(false) // Auto-generated from subscription
  status      DeliveryStatus @default(DELIVERED)
  
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([businessId, date])
  @@index([customerId, date])
}

enum Shift {
  MORNING
  EVENING
}

enum DeliveryStatus {
  DELIVERED
  SKIPPED    // Customer requested skip
  CANCELLED  // Not delivered
}

model Payment {
  id          String   @id @default(cuid())
  
  // Offline sync fields
  localId     String?  @unique
  syncStatus  SyncStatus @default(SYNCED)
  
  businessId  String
  business    Business @relation(fields: [businessId], references: [id])
  
  // Either farmer OR customer (not both)
  farmerId    String?
  farmer      Farmer?  @relation(fields: [farmerId], references: [id])
  customerId  String?
  customer    Customer?@relation(fields: [customerId], references: [id])
  
  recordedBy  String
  user        User     @relation(fields: [recordedBy], references: [id])
  
  date        DateTime @db.Date
  amount      Decimal  @db.Decimal(10, 2)
  type        PaymentType
  method      PaymentMethod @default(CASH)
  
  notes       String?
  createdAt   DateTime @default(now())
  
  @@index([businessId, date])
  @@index([farmerId])
  @@index([customerId])
}

enum PaymentType {
  PAID_TO_FARMER    // We pay farmer
  RECEIVED_FROM_CUSTOMER // Customer pays us
  ADVANCE_TO_FARMER // Advance given to farmer
  ADVANCE_FROM_CUSTOMER // Advance from customer
}

enum PaymentMethod {
  CASH
  UPI
  BANK_TRANSFER
  OTHER
}

enum SyncStatus {
  PENDING   // Created offline, needs sync
  SYNCING   // Currently syncing
  SYNCED    // Successfully synced
  FAILED    // Sync failed, needs retry
}

// ============================================
// SUPER ADMIN & SUBSCRIPTION MODELS
// ============================================

// Super Admin (YOU - the developer)
model AdminUser {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   // bcrypt hash of strong password
  name          String
  secretKey     String   @unique // For initial setup API
  
  // Password reset
  resetToken    String?
  resetExpires  DateTime?
  
  createdAt     DateTime @default(now())
  lastLogin     DateTime?
}

// Subscription tracking for businesses
model Subscription {
  id            String   @id @default(cuid())
  businessId    String   @unique
  business      Business @relation(fields: [businessId], references: [id])
  
  plan          SubscriptionPlan @default(MONTHLY)
  status        SubscriptionStatus @default(INACTIVE)
  
  startDate     DateTime?
  endDate       DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Payment history for subscriptions
model SubscriptionPayment {
  id            String   @id @default(cuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id])
  
  plan          SubscriptionPlan
  amount        Decimal  @db.Decimal(10, 2)
  
  paymentMethod String?  // CASH, UPI, BANK_TRANSFER
  transactionId String?  // UPI ref number, bank ref, etc.
  notes         String?
  
  paidAt        DateTime @default(now())
  validFrom     DateTime
  validUntil    DateTime
  
  recordedBy    String   // Admin user ID who recorded this
  
  @@index([businessId, paidAt])
}

enum SubscriptionPlan {
  MONTHLY       // ₹299 - 30 days
  QUARTERLY     // ₹799 - 90 days
  HALF_YEARLY   // ₹1499 - 180 days
  ANNUAL        // ₹2499 - 365 days
}

enum SubscriptionStatus {
  INACTIVE      // Never activated
  ACTIVE        // Currently active
  EXPIRED       // Was active, now expired
  SUSPENDED     // Manually suspended by admin
}
```

---

## Offline-First Architecture

### IndexedDB Schema (Dexie.js)

```typescript
// src/db/localDb.ts
import Dexie, { Table } from 'dexie';

export interface LocalFarmer {
  id: string;          // Server ID or local UUID
  localId: string;     // Always local UUID
  syncStatus: 'pending' | 'synced' | 'failed';
  data: {
    name: string;
    phone?: string;
    village?: string;
    isActive: boolean;
    balance: number;
  };
  updatedAt: number;   // Timestamp for conflict resolution
}

export interface LocalCollection {
  id: string;
  localId: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  data: {
    farmerId: string;
    date: string;      // ISO date
    shift: 'MORNING' | 'EVENING';
    quantity: number;
    fatContent?: number;
    ratePerLiter: number;
    totalAmount: number;
    notes?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// Similar interfaces for Customer, Delivery, Payment...

class MilkAppDB extends Dexie {
  farmers!: Table<LocalFarmer>;
  customers!: Table<LocalCustomer>;
  collections!: Table<LocalCollection>;
  deliveries!: Table<LocalDelivery>;
  payments!: Table<LocalPayment>;
  rates!: Table<LocalRate>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('milkapp');
    
    this.version(1).stores({
      farmers: 'id, localId, syncStatus, updatedAt',
      customers: 'id, localId, syncStatus, updatedAt',
      collections: 'id, localId, syncStatus, [data.farmerId+data.date], updatedAt',
      deliveries: 'id, localId, syncStatus, [data.customerId+data.date], updatedAt',
      payments: 'id, localId, syncStatus, [data.farmerId], [data.customerId], updatedAt',
      rates: 'id, localId, syncStatus',
      syncQueue: '++id, table, operation, status, createdAt'
    });
  }
}

export const db = new MilkAppDB();
```

### Sync Strategy

```typescript
// src/services/syncService.ts

interface SyncQueueItem {
  id?: number;
  table: string;
  localId: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  status: 'pending' | 'processing' | 'failed';
  retryCount: number;
  createdAt: number;
}

class SyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.isOnline = false);
  }

  private async handleOnline() {
    this.isOnline = true;
    await this.processSyncQueue();
  }

  // Add operation to sync queue
  async queueSync(item: Omit<SyncQueueItem, 'id' | 'status' | 'retryCount' | 'createdAt'>) {
    await db.syncQueue.add({
      ...item,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now()
    });

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  // Process pending sync items
  async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('createdAt');

      for (const item of pendingItems) {
        try {
          await db.syncQueue.update(item.id!, { status: 'processing' });
          
          const result = await this.syncItem(item);
          
          // Update local record with server ID
          if (result.serverId) {
            await this.updateLocalWithServerId(item.table, item.localId, result.serverId);
          }
          
          // Remove from queue on success
          await db.syncQueue.delete(item.id!);
          
        } catch (error) {
          const newRetryCount = item.retryCount + 1;
          
          if (newRetryCount >= 3) {
            await db.syncQueue.update(item.id!, { 
              status: 'failed',
              retryCount: newRetryCount 
            });
          } else {
            await db.syncQueue.update(item.id!, { 
              status: 'pending',
              retryCount: newRetryCount 
            });
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: SyncQueueItem) {
    const endpoint = `/api/${item.table}`;
    
    switch (item.operation) {
      case 'create':
        return api.post(endpoint, item.data);
      case 'update':
        return api.put(`${endpoint}/${item.data.id}`, item.data);
      case 'delete':
        return api.delete(`${endpoint}/${item.data.id}`);
    }
  }
}

export const syncService = new SyncService();
```

---

## Feature Modules

### 1. Authentication Module

```typescript
// Features:
// - Phone + 4-digit PIN login (simple for rural users)
// - Business registration
// - Staff invitation via PIN
// - Session management with refresh tokens

// Screens:
// - Login (phone + PIN)
// - Register Business
// - Invite Staff
// - Profile Settings
```

### 2. Dashboard Module

```typescript
// Today's snapshot:
// - Total milk collected (morning/evening)
// - Total milk sold
// - Pending collections (subscription customers not yet served)
// - Cash in hand (today's collections)
// - Quick action buttons

// Components:
// - StatCard (collection/sales/payments summary)
// - TodayCollectionList
// - TodayDeliveryList  
// - PendingSubscriptions
// - QuickActions (Add Collection, Add Delivery, etc.)
```

### 3. Farmers Module

```typescript
// Screens:
// - Farmer List (SORTABLE - drag to reorder, order is SAVED)
// - Add/Edit Farmer (includes DEFAULT RATE setting)
// - Farmer Detail (collections history, payments, balance)
// - Farmer Rate Settings

// Key Features:
// - CUSTOM SORT ORDER: Drag farmers up/down, order saved per user
// - Default rate set during farmer creation
// - Balance tracking (we owe them)
// - Collection history with RATE SHOWN for each entry
// - Owner can EDIT any collection's rate before payment
// - Payment history
// - Quick payment recording

// Farmer Creation includes:
// - Name, Phone, Village
// - DEFAULT RATE PER LITER (used as pre-fill during collection)
// - Rate can vary per collection (edited at collection time)
```

### Farmer List Sorting

```typescript
// Sort Order Feature:
// - Each user can arrange farmers in preferred order
// - Drag handle on each farmer row
// - Order persisted to database (per user, per business)
// - Useful for route-based ordering (visit farmer A first, then B, etc.)
// - Search still works within sorted list

// Implementation:
// - Add `sortOrder` field to farmer (per user context)
// - Store in separate UserFarmerOrder table for multi-user support
// - Sync sort order with offline support
```

### 4. Customers Module

```typescript
// Screens:
// - Customer List (SORTABLE - drag to reorder, order is SAVED)
// - Add/Edit Customer (includes DEFAULT RATE setting)
// - Customer Detail (deliveries, payments, balance)
// - Subscription Settings

// Key Features:
// - CUSTOM SORT ORDER: Drag customers up/down, order saved per user
// - Default rate set during customer creation
// - Subscription management (daily quantity, AM/PM)
// - Balance tracking (they owe us)
// - Delivery history with RATE SHOWN for each entry
// - Payment recording from delivery screen
// - Skip/pause subscription

// Customer Creation includes:
// - Name, Phone, Address
// - DEFAULT RATE PER LITER (shown during delivery, editable per delivery)
// - Subscription quantity and shift preferences
```

### Customer List Sorting

```typescript
// Sort Order Feature:
// - Each delivery person can arrange customers in preferred route order
// - Drag handle on each customer row
// - Order persisted (per user, per business)
// - Useful for delivery route optimization
// - Separate sort orders for Morning vs Evening shifts possible

// Implementation:
// - Add `sortOrder` field (per user context)
// - Store in UserCustomerOrder table
// - Sync with offline support
```

### 5. Collection Module (Purchase from Farmers)

```typescript
// Screens:
// - Quick Collection Entry (optimized for speed)
// - Collection History
// - Bulk Collection Entry (multiple farmers)

// Quick Entry Flow:
// 1. Select farmer from SORTABLE list (custom order saved)
// 2. See farmer's DEFAULT RATE prominently displayed
// 3. Enter quantity (large number pad)
// 4. Optional: Enter fat content
// 5. CAN EDIT RATE for THIS collection only (doesn't change farmer's default)
// 6. Auto-calculate total
// 7. Save (works offline)

// Key Features:
// - Morning/Evening shift toggle
// - Fat content entry (optional)
// - VISIBLE DEFAULT RATE from farmer profile
// - EDITABLE RATE per collection (change applies ONLY to this record)
// - Rate changes tracked in history for reports
// - Running total for the day
// - Offline queue with sync indicator
// - Can collect ANYTIME (between deliveries, any time of day)
```

### Rate Handling for Collections

```typescript
// Rate Flow:
// 1. Farmer created with DEFAULT rate (e.g., ₹42/L)
// 2. During collection, rate is PRE-FILLED with default
// 3. Collector CAN change rate for this collection only
// 4. Changed rate saved ONLY for this collection record
// 5. Farmer's default rate remains unchanged
// 6. Owner can EDIT rate on any collection BEFORE payment
// 7. Reports show actual rate used per collection (may vary day to day)

// Example:
// - Farmer Kumar: Default rate ₹42/L
// - Monday collection: 10L × ₹42 = ₹420 (default used)
// - Tuesday collection: 12L × ₹44 = ₹528 (rate edited due to high fat)
// - Wednesday collection: 8L × ₹42 = ₹336 (back to default)
// - Report shows all three with their respective rates
```

### 6. Delivery Module (Sales to Customers)

```typescript
// Screens:
// - Today's Deliveries (SORTABLE list, order saved)
// - Quick Delivery Entry
// - Delivery History

// Today's Delivery Flow:
// 1. Show all subscribed customers in CUSTOM SORTED ORDER
// 2. Each customer shows: Name, Qty, RATE, Balance Due
// 3. One-tap to mark delivered (uses subscription qty & default rate)
// 4. Tap to modify quantity OR rate if different
// 5. RECEIVE PAYMENT button visible inline for each customer
// 6. Mark as skipped if not delivered

// Key Features:
// - SORTABLE delivery list (drag to reorder route)
// - Sort order saved per user (delivery route optimization)
// - VISIBLE RATE next to each customer
// - EDITABLE RATE per delivery (changes only this delivery record)
// - Rate changes don't affect other deliveries or customer's default
// - INLINE PAYMENT: "₹ Receive" button on each customer row
// - Can receive payment DURING delivery or ANY time
// - Auto-generate from subscriptions
// - Bulk mark delivered
// - Quick quantity adjustment
// - Skip/cancel with reason
// - Can do collections IN BETWEEN deliveries (no restriction)
```

### Delivery Screen Layout

```typescript
// Each customer row shows:
// ┌─────────────────────────────────────────────┐
// │ 👤 Mrs. Priya                    [✓ Done]  │
// │    2.0L × ₹45/L = ₹90                      │
// │    📍 Gandhi Street                         │
// │    ┌──────────┐  ┌──────────────────┐      │
// │    │ ✏️ Edit  │  │ 💵 Receive ₹450 │      │
// │    └──────────┘  └──────────────────┘      │
// │    Balance due: ₹450                        │
// └─────────────────────────────────────────────┘

// Edit opens:
// - Quantity field (pre-filled with subscription)
// - Rate field (pre-filled with customer's default rate)
// - Both editable, affects ONLY this delivery

// Receive Payment opens:
// - Amount field (pre-filled with balance due)
// - Payment method (Cash/UPI/Bank)
// - Can receive partial or full payment
// - Can receive payment even if delivery not done yet
```

### Rate Handling for Deliveries

```typescript
// Rate Flow:
// 1. Customer created with DEFAULT rate (e.g., ₹45/L)
// 2. During delivery, rate is PRE-FILLED with default
// 3. Delivery person CAN change rate for this delivery only
// 4. Changed rate saved ONLY for this delivery record
// 5. Customer's default rate remains unchanged
// 6. Reports show actual rate used per delivery (may vary)

// Example:
// - Customer Priya: Default rate ₹45/L
// - Monday: 2L × ₹45 = ₹90 (default)
// - Tuesday: 2L × ₹50 = ₹100 (special request, premium milk)
// - Wednesday: 3L × ₹45 = ₹135 (extra qty, default rate)
// - Report shows all with their actual rates
```

### 7. Payments Module

```typescript
// Screens:
// - Record Payment (Farmer/Customer) - Standalone screen
// - Payment History
// - Pending Dues List

// TWO WAYS TO RECORD CUSTOMER PAYMENT:
// 1. INLINE (from delivery screen): Quick "Receive" button next to each customer
// 2. STANDALONE (from payments module): For payments outside delivery time

// Key Features:
// - Pay to farmer (reduces our debt)
// - Receive from customer (reduces their debt)
// - INLINE PAYMENT during delivery (most common use case)
// - STANDALONE PAYMENT anytime (customer comes to shop, pays at month end)
// - Advance payments
// - Payment method (Cash/UPI/Bank)
// - Balance auto-update
// - Payment can be received ANY day, ANY time
// - Partial payments supported
```

### Payment Flows

```typescript
// Flow 1: Payment DURING Delivery (Inline)
// - Delivery person at customer's door
// - Marks delivery done
// - Customer says "take this week's payment"
// - Taps "Receive ₹XXX" button right there
// - Quick payment recorded without leaving delivery screen

// Flow 2: Payment SEPARATE from Delivery (Standalone)
// - Customer visits shop/office
// - Or pays via UPI later in the day
// - Go to Payments → Record Payment
// - Select customer, enter amount, save

// Flow 3: Farmer Payment (Always Standalone)
// - Owner goes to Farmer detail or Payments module
// - Reviews pending amount
// - CAN EDIT collection rates before paying (if correction needed)
// - Records payment to farmer

// All payments sync offline and update balances immediately
```

### 8. Reports Module

```typescript
// Reports:
// - Daily Summary (collection vs sales, profit)
// - Farmer Payment Report (period-wise dues with RATE BREAKDOWN)
// - Customer Dues Report (with rate variations shown)
// - Collection Report (by farmer, date range, SHOWS RATE PER ENTRY)
// - Sales Report (by customer, date range, SHOWS RATE PER ENTRY)
// - Profit/Loss Report

// Features:
// - Date range filter
// - Export to PDF/Excel
// - Share via WhatsApp
// - Print support
// - RATE VARIATIONS clearly shown (not averaged)
```

### Rate Handling in Reports

```typescript
// IMPORTANT: Reports show ACTUAL rates used, not averaged

// Farmer Collection Report Example:
// ┌────────────┬────────┬────────┬─────────┐
// │ Date       │ Liters │ Rate/L │ Amount  │
// ├────────────┼────────┼────────┼─────────┤
// │ Feb 1      │ 10.0   │ ₹42    │ ₹420    │
// │ Feb 2      │ 12.0   │ ₹44    │ ₹528    │  ← Different rate
// │ Feb 3      │  8.0   │ ₹42    │ ₹336    │
// ├────────────┼────────┼────────┼─────────┤
// │ TOTAL      │ 30.0   │ (var)  │ ₹1,284  │  ← No avg rate, just total
// └────────────┴────────┴────────┴─────────┘

// Customer Delivery Report Example:
// ┌────────────┬────────┬────────┬─────────┐
// │ Date       │ Liters │ Rate/L │ Amount  │
// ├────────────┼────────┼────────┼─────────┤
// │ Feb 1      │ 2.0    │ ₹45    │ ₹90     │
// │ Feb 2      │ 2.0    │ ₹50    │ ₹100    │  ← Special rate that day
// │ Feb 3      │ 3.0    │ ₹45    │ ₹135    │
// ├────────────┼────────┼────────┼─────────┤
// │ TOTAL      │ 7.0    │ (var)  │ ₹325    │  ← Total shows sum, not avg
// └────────────┴────────┴────────┴─────────┘

// Key: 
// - Each row shows the ACTUAL rate used that day
// - Total row shows "(var)" or blank for rate column
// - Total amount is SUM of all amounts (not qty × some rate)
// - This preserves accuracy when rates vary
```

### Owner Rate Editing (Pre-Payment)

```typescript
// Before paying a farmer, owner can review and edit rates:
// 
// ┌─────────────────────────────────────────────┐
// │ Payment Review: Kumar                       │
// │ Period: Feb 1-7                             │
// ├─────────────────────────────────────────────┤
// │ Date    │ Liters │ Rate  │ Amount │ Action │
// │ Feb 1   │ 10.0   │ ₹42   │ ₹420   │ [Edit] │
// │ Feb 2   │ 12.0   │ ₹44   │ ₹528   │ [Edit] │ ← Can correct
// │ Feb 3   │  8.0   │ ₹42   │ ₹336   │ [Edit] │
// ├─────────────────────────────────────────────┤
// │ TOTAL: 30.0 L           │ ₹1,284           │
// ├─────────────────────────────────────────────┤
// │ [ Pay ₹1,284 ]                             │
// └─────────────────────────────────────────────┘
//
// Clicking [Edit] allows changing rate for that specific collection
// Useful for corrections, negotiations, quality adjustments
// Changes are tracked (audit log)
```

---

## UI/UX Guidelines

### Design Principles

1. **Large Touch Targets**: Minimum 48px for buttons (rural users, rough hands)
2. **High Contrast**: Works in sunlight
3. **Minimal Text Input**: Use number pads, dropdowns, quick select
4. **Visual Feedback**: Clear success/error states
5. **Offline Indicator**: Always visible sync status

### Color Palette

```css
:root {
  /* Primary - Fresh milk blue */
  --primary-50: #EFF6FF;
  --primary-500: #3B82F6;
  --primary-600: #2563EB;
  --primary-700: #1D4ED8;
  
  /* Success - Money green */
  --success-500: #22C55E;
  
  /* Warning - Pending orange */
  --warning-500: #F59E0B;
  
  /* Error - Due red */
  --error-500: #EF4444;
  
  /* Neutral */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-500: #6B7280;
  --gray-900: #111827;
}
```

### Component Library

```typescript
// Core components to build:

// Layout
- AppShell (header, nav, content)
- BottomNav (mobile navigation)
- PageHeader

// Forms
- NumberPad (large digit entry)
- QuickSelect (farmer/customer picker with search)
- DatePicker (simple, touch-friendly)
- ShiftToggle (Morning/Evening)

// Display
- StatCard
- ListItem (farmer/customer/transaction row)
- BalanceChip (shows +/- amount with color)
- SyncIndicator (online/offline/syncing)

// Feedback
- Toast (success/error messages)
- ConfirmDialog
- LoadingSpinner
```

### Screen Layouts

```
┌─────────────────────────────────┐
│  Header (Title + Actions)       │
├─────────────────────────────────┤
│                                 │
│                                 │
│        Main Content             │
│        (Scrollable)             │
│                                 │
│                                 │
├─────────────────────────────────┤
│  ● Home  ● Collect  ● Sell  ●  │
│         Bottom Navigation       │
└─────────────────────────────────┘
```

---

## PWA Configuration

### manifest.json

```json
{
  "name": "DudhWala - Milk Management",
  "short_name": "DudhWala",
  "description": "Milk collection and sales management for milkmen",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563EB",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Service Worker Strategy

```typescript
// vite.config.ts - VitePWA config
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        
        // Runtime caching for API
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      manifest: {
        // ... manifest.json content
      }
    })
  ]
});
```

---

## Internationalization (i18n)

### Setup

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ta from './locales/ta.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta }
  },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
```

### Translation Files

```json
// src/i18n/locales/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "loading": "Loading...",
    "offline": "You are offline",
    "syncing": "Syncing..."
  },
  "nav": {
    "home": "Home",
    "collect": "Collect",
    "deliver": "Deliver",
    "reports": "Reports",
    "settings": "Settings"
  },
  "dashboard": {
    "todayCollection": "Today's Collection",
    "todaySales": "Today's Sales",
    "pendingDues": "Pending Dues",
    "liters": "Liters",
    "morning": "Morning",
    "evening": "Evening"
  },
  "farmer": {
    "title": "Farmers",
    "addNew": "Add Farmer",
    "name": "Name",
    "phone": "Phone",
    "village": "Village",
    "balance": "Balance",
    "weOwe": "We owe",
    "theyOwe": "They owe"
  },
  "collection": {
    "title": "Milk Collection",
    "selectFarmer": "Select Farmer",
    "quantity": "Quantity (Liters)",
    "fatContent": "Fat Content (%)",
    "rate": "Rate per Liter",
    "total": "Total Amount"
  },
  "customer": {
    "title": "Customers",
    "addNew": "Add Customer",
    "subscription": "Daily Subscription",
    "address": "Address"
  },
  "delivery": {
    "title": "Deliveries",
    "markDelivered": "Mark Delivered",
    "skip": "Skip Today",
    "pending": "Pending"
  },
  "payment": {
    "title": "Payments",
    "payFarmer": "Pay to Farmer",
    "receiveCustomer": "Receive from Customer",
    "amount": "Amount",
    "method": "Payment Method",
    "cash": "Cash",
    "upi": "UPI",
    "bank": "Bank Transfer"
  },
  "reports": {
    "title": "Reports",
    "daily": "Daily Summary",
    "farmerDues": "Farmer Dues",
    "customerDues": "Customer Dues",
    "dateRange": "Date Range",
    "export": "Export",
    "print": "Print"
  }
}
```

```json
// src/i18n/locales/ta.json
{
  "common": {
    "save": "சேமி",
    "cancel": "ரத்து",
    "delete": "நீக்கு",
    "edit": "திருத்து",
    "search": "தேடு",
    "loading": "ஏற்றுகிறது...",
    "offline": "இணைப்பு இல்லை",
    "syncing": "ஒத்திசைக்கிறது..."
  },
  "nav": {
    "home": "முகப்பு",
    "collect": "சேகரிப்பு",
    "deliver": "விநியோகம்",
    "reports": "அறிக்கைகள்",
    "settings": "அமைப்புகள்"
  },
  "dashboard": {
    "todayCollection": "இன்றைய சேகரிப்பு",
    "todaySales": "இன்றைய விற்பனை",
    "pendingDues": "நிலுவை தொகை",
    "liters": "லிட்டர்",
    "morning": "காலை",
    "evening": "மாலை"
  },
  "farmer": {
    "title": "விவசாயிகள்",
    "addNew": "புதிய விவசாயி",
    "name": "பெயர்",
    "phone": "தொலைபேசி",
    "village": "கிராமம்",
    "balance": "இருப்பு",
    "weOwe": "நாம் தர வேண்டியது",
    "theyOwe": "அவர்கள் தர வேண்டியது"
  },
  "collection": {
    "title": "பால் சேகரிப்பு",
    "selectFarmer": "விவசாயியை தேர்வு செய்க",
    "quantity": "அளவு (லிட்டர்)",
    "fatContent": "கொழுப்பு சதவீதம்",
    "rate": "லிட்டர் விலை",
    "total": "மொத்த தொகை"
  },
  "customer": {
    "title": "வாடிக்கையாளர்கள்",
    "addNew": "புதிய வாடிக்கையாளர்",
    "subscription": "தினசரி சந்தா",
    "address": "முகவரி"
  },
  "delivery": {
    "title": "விநியோகங்கள்",
    "markDelivered": "வழங்கியது",
    "skip": "இன்று தவிர்",
    "pending": "நிலுவையில்"
  },
  "payment": {
    "title": "கொடுப்பனவுகள்",
    "payFarmer": "விவசாயிக்கு பணம்",
    "receiveCustomer": "வாடிக்கையாளரிடம் பெற்றது",
    "amount": "தொகை",
    "method": "கொடுப்பனவு முறை",
    "cash": "பணம்",
    "upi": "UPI",
    "bank": "வங்கி பரிமாற்றம்"
  },
  "reports": {
    "title": "அறிக்கைகள்",
    "daily": "தினசரி சுருக்கம்",
    "farmerDues": "விவசாயி நிலுவை",
    "customerDues": "வாடிக்கையாளர் நிலுவை",
    "dateRange": "தேதி வரம்பு",
    "export": "ஏற்றுமதி",
    "print": "அச்சிடு"
  }
}
```

---

## API Endpoints

### 🔐 Initial Setup (Hit from Postman - ONE TIME ONLY)
```
POST   /api/setup/init-admin
       - Creates YOUR admin account (first time only)
       - Request: { email, password, name, setupSecret }
       - setupSecret must match SETUP_SECRET env variable
       - Returns: { success, adminId }
       - DISABLE THIS ENDPOINT AFTER FIRST USE (or auto-disable)
```

### 🔐 Admin Panel Authentication (YOUR login - separate from app users)
```
POST   /api/admin/login        - Admin login with email + password
POST   /api/admin/logout       - Admin logout
POST   /api/admin/refresh      - Refresh admin token
POST   /api/admin/forgot-password - Send reset email
POST   /api/admin/reset-password  - Reset with token from email
```

### 🔐 Admin Panel - Business Management (Only YOU can access)
```
GET    /api/admin/businesses           - List all businesses
GET    /api/admin/businesses/:id       - Get business details
PUT    /api/admin/businesses/:id       - Update business
DELETE /api/admin/businesses/:id       - Delete business (soft)
POST   /api/admin/businesses/:id/activate   - Activate business
POST   /api/admin/businesses/:id/suspend    - Suspend business
```

### 🔐 Admin Panel - User PIN Reset (Only YOU can access)
```
GET    /api/admin/businesses/:id/users      - List users in a business
POST   /api/admin/users/:id/reset-pin       - Reset any user's PIN
       - Request: { newPin: "1234" }
       - Sets mustChangePin: true
       - Returns: { success, tempPin }
```

### 🔐 Admin Panel - Subscription Management (Only YOU can access)
```
GET    /api/admin/subscriptions             - List all subscriptions
GET    /api/admin/subscriptions/expiring    - List expiring soon (7 days)
GET    /api/admin/subscriptions/expired     - List expired subscriptions
POST   /api/admin/subscriptions/record-payment - Record payment & activate
       - Request: { businessId, plan, amount, paymentMethod, transactionId }
       - Auto-calculates validFrom and validUntil
       - Returns: { success, subscription, validUntil }
PUT    /api/admin/subscriptions/:id/extend  - Extend subscription manually
```

### 🔐 Admin Panel - Dashboard & Reports (Only YOU can access)
```
GET    /api/admin/dashboard            - Overview stats
GET    /api/admin/revenue              - Revenue reports
GET    /api/admin/revenue/monthly      - Monthly breakdown
```

---

### Mobile App - Authentication (Business owners & staff)
```
POST   /api/auth/register     - Register new business (creates INACTIVE subscription)
POST   /api/auth/login        - Login with phone + PIN
POST   /api/auth/refresh      - Refresh token
POST   /api/auth/logout       - Logout
GET    /api/auth/subscription - Check subscription status (for app to show block screen)
```

### Mobile App & Web - Business & Users
```
GET    /api/business          - Get current business details
PUT    /api/business          - Update business details
GET    /api/users             - List staff members
POST   /api/users             - Invite new staff (Owner only)
PUT    /api/users/:id         - Update staff
DELETE /api/users/:id         - Remove staff (Owner only)
PUT    /api/users/:id/reset-pin - Owner resets staff PIN
POST   /api/users/change-pin  - User changes own PIN
```

### Farmers
```
GET    /api/farmers           - List farmers (paginated, searchable, WITH SORT ORDER)
POST   /api/farmers           - Add farmer (includes defaultRate)
GET    /api/farmers/:id       - Get farmer details
PUT    /api/farmers/:id       - Update farmer (including defaultRate)
DELETE /api/farmers/:id       - Delete farmer (soft)
GET    /api/farmers/:id/collections - Farmer's collection history (shows rate per entry)
GET    /api/farmers/:id/payments    - Farmer's payment history
PUT    /api/farmers/sort-order      - Update farmer sort order for current user
```

### Customers
```
GET    /api/customers         - List customers (WITH SORT ORDER per shift)
POST   /api/customers         - Add customer (includes defaultRate)
GET    /api/customers/:id     - Get customer details
PUT    /api/customers/:id     - Update customer (including defaultRate)
DELETE /api/customers/:id     - Delete customer (soft)
GET    /api/customers/:id/deliveries - Customer's delivery history (shows rate per entry)
GET    /api/customers/:id/payments   - Customer's payment history
PUT    /api/customers/sort-order     - Update customer sort order for current user
```

### Collections
```
GET    /api/collections       - List collections (date filtered, shows rate per entry)
POST   /api/collections       - Record collection (rate from farmer default or custom)
PUT    /api/collections/:id   - Update collection (OWNER can edit rate before payment)
DELETE /api/collections/:id   - Delete collection
POST   /api/collections/bulk  - Bulk sync (offline queue)
```

### Deliveries
```
GET    /api/deliveries        - List deliveries (shows rate per entry)
POST   /api/deliveries        - Record delivery (rate from customer default or custom)
PUT    /api/deliveries/:id    - Update delivery (can edit rate)
DELETE /api/deliveries/:id    - Delete delivery
GET    /api/deliveries/today  - Today's pending deliveries (SORTED, with rate & balance)
POST   /api/deliveries/bulk   - Bulk update (mark multiple delivered)
```

### Payments
```
GET    /api/payments          - List payments
POST   /api/payments          - Record payment (standalone OR inline from delivery)
PUT    /api/payments/:id      - Update payment
DELETE /api/payments/:id      - Delete payment
POST   /api/payments/inline   - Quick inline payment (from delivery screen)
```

### Reports
```
GET    /api/reports/daily?date=YYYY-MM-DD
GET    /api/reports/farmer-dues?from=&to=
GET    /api/reports/customer-dues?from=&to=
GET    /api/reports/collections?from=&to=&farmerId=
GET    /api/reports/deliveries?from=&to=&customerId=
GET    /api/reports/profit?from=&to=
```

### Sync
```
POST   /api/sync/push         - Push offline changes
GET    /api/sync/pull?since=  - Pull changes since timestamp
```

---

## Initial Admin Setup (Postman - One Time)

### Step 1: Set Environment Variable on Server

```bash
# In your .env file on server
SETUP_SECRET=your-super-secret-key-change-this-abc123xyz
```

### Step 2: Hit the Endpoint from Postman

```
POST https://api.dudhwala.com/api/setup/init-admin

Headers:
  Content-Type: application/json

Body:
{
  "email": "yourname@gmail.com",
  "password": "YourSecurePassword@123",
  "name": "Your Name",
  "setupSecret": "your-super-secret-key-change-this-abc123xyz"
}

Response (Success):
{
  "success": true,
  "message": "Admin account created successfully",
  "adminId": "clx1234567890",
  "email": "yourname@gmail.com"
}

Response (Already exists):
{
  "success": false,
  "error": "Admin already exists. This endpoint is disabled."
}

Response (Wrong secret):
{
  "success": false,
  "error": "Invalid setup secret"
}
```

### Step 3: Implementation Code

```typescript
// server/src/routes/setup.ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/init-admin', async (req, res) => {
  try {
    const { email, password, name, setupSecret } = req.body;
    
    // 1. Verify setup secret
    if (setupSecret !== process.env.SETUP_SECRET) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid setup secret' 
      });
    }
    
    // 2. Check if admin already exists
    const existingAdmin = await prisma.adminUser.findFirst();
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Admin already exists. This endpoint is disabled.' 
      });
    }
    
    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // 4. Create admin
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name,
        secretKey: crypto.randomUUID(), // For future API access if needed
      }
    });
    
    // 5. Return success
    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      adminId: admin.id,
      email: admin.email
    });
    
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create admin' 
    });
  }
});

export default router;
```

### Step 4: After Setup, Remove or Disable the Endpoint

```typescript
// Option A: Check if admin exists (auto-disable)
// Already implemented above - returns error if admin exists

// Option B: Remove from environment after setup
// Delete SETUP_SECRET from .env file

// Option C: Remove route entirely after setup
// Comment out or delete the route from your code
```

---

## Platform Architecture (3 Interfaces)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          DudhWala Platform                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │                 │  │                 │  │                             │ │
│  │  📱 Mobile PWA  │  │  💻 Owner Web   │  │  🔐 Admin Panel             │ │
│  │                 │  │                 │  │                             │ │
│  │  For: Staff     │  │  For: Business  │  │  For: YOU (Developer)       │ │
│  │       Owners    │  │       Owners    │  │                             │ │
│  │                 │  │                 │  │                             │ │
│  │  - Collections  │  │  - Same as PWA  │  │  - Manage all businesses    │ │
│  │  - Deliveries   │  │  - Better for   │  │  - Reset any PIN            │ │
│  │  - Payments     │  │    reports      │  │  - Subscriptions            │ │
│  │  - Quick entry  │  │  - Print bills  │  │  - Revenue tracking         │ │
│  │  - Offline      │  │  - Desktop UX   │  │                             │ │
│  │                 │  │                 │  │                             │ │
│  │  app.dudhwala   │  │  app.dudhwala   │  │  admin.dudhwala.com         │ │
│  │  .com           │  │  .com (desktop) │  │                             │ │
│  │                 │  │                 │  │                             │ │
│  │  Login: Phone   │  │  Login: Phone   │  │  Login: Email + Password    │ │
│  │         + PIN   │  │         + PIN   │  │                             │ │
│  │                 │  │                 │  │                             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│           │                   │                         │                   │
│           └───────────────────┴─────────────────────────┘                   │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │                     │                                  │
│                    │    Backend API      │                                  │
│                    │    (Node.js)        │                                  │
│                    │                     │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │                     │                                  │
│                    │    PostgreSQL       │                                  │
│                    │    Database         │                                  │
│                    │                     │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Business Owner Web View

### Same App, Responsive Design

The Mobile PWA and Owner Web are the **SAME application** - just responsive:

```typescript
// Responsive breakpoints
// Mobile: < 768px  → Bottom navigation, compact UI
// Tablet: 768-1024px → Side navigation, medium UI
// Desktop: > 1024px → Side navigation, full UI with more data visible
```

### Desktop-Specific Features for Owners

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🥛 DudhWala                               Murugan Milk Supply    [Logout]  │
├────────────────┬────────────────────────────────────────────────────────────┤
│                │                                                            │
│  📊 Dashboard  │   Dashboard                              Feb 3, 2025       │
│                │                                                            │
│  👨‍🌾 Farmers    │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│                │   │  Today's     │ │  Today's     │ │  Pending     │      │
│  👥 Customers  │   │  Collection  │ │  Sales       │ │  Dues        │      │
│                │   │              │ │              │ │              │      │
│  📥 Collection │   │  45.5 L      │ │  38.0 L      │ │  ₹12,450     │      │
│                │   │  ₹1,932      │ │  ₹1,710      │ │              │      │
│  🚚 Deliveries │   └──────────────┘ └──────────────┘ └──────────────┘      │
│                │                                                            │
│  💰 Payments   │   Recent Activity                                          │
│                │   ┌────────────────────────────────────────────────────┐  │
│  📊 Reports    │   │ Time   │ Type       │ Person    │ Qty   │ Amount  │  │
│    ├─ Daily    │   ├────────┼────────────┼───────────┼───────┼─────────┤  │
│    ├─ Farmer   │   │ 6:30am │ Collection │ Kumar     │ 12 L  │ ₹504    │  │
│    ├─ Customer │   │ 6:45am │ Collection │ Lakshmi   │ 8 L   │ ₹384    │  │
│    └─ P&L      │   │ 7:00am │ Delivery   │ Mrs.Priya │ 2 L   │ ₹90     │  │
│                │   │ 7:15am │ Payment    │ Mr.Venkat │ -     │ ₹315    │  │
│  ⚙️ Settings   │   └────────────────────────────────────────────────────┘  │
│                │                                                            │
│  👥 Staff      │   Quick Actions                                            │
│                │   [ + Collection ]  [ + Delivery ]  [ + Payment ]          │
│                │                                                            │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Desktop-Only Enhancements

| Feature | Mobile | Desktop |
|---------|--------|---------|
| Navigation | Bottom tabs | Side menu |
| Data tables | Card view, scrollable | Full table with sorting |
| Reports | Basic view | Print-friendly, export options |
| Bulk actions | One at a time | Multi-select |
| Dashboard | Summary only | Summary + activity feed |
| Data entry | Number pad | Keyboard input |

### Reports - Better on Desktop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Farmer Dues Report                                    [ 🖨 Print ] [ ⬇ Export ]│
│  Period: Jan 27 - Feb 3, 2025                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────┬────────────┬────────┬────────┬────────┬─────────┬─────────┐ │
│  │ Farmer    │ Village    │ Phone  │ Liters │ Amount │ Paid    │ Balance │ │
│  ├───────────┼────────────┼────────┼────────┼────────┼─────────┼─────────┤ │
│  │ Kumar     │ Thingalur  │ 98765..│ 78.5   │ ₹3,297 │ ₹3,000  │ ₹297    │ │
│  │ Lakshmi   │ Kavundapar │ 87654..│ 56.0   │ ₹2,688 │ ₹2,688  │ ₹0      │ │
│  │ Senthil   │ Modakurichi│ 76543..│ 108.5  │ ₹4,340 │ ₹4,000  │ ₹340    │ │
│  │ Mani      │ Perundurai │ 65432..│ 74.0   │ ₹2,968 │ ₹0      │ ₹2,968  │ │
│  ├───────────┼────────────┼────────┼────────┼────────┼─────────┼─────────┤ │
│  │ TOTAL     │            │        │ 317.0  │₹13,293 │ ₹9,688  │ ₹3,605  │ │
│  └───────────┴────────────┴────────┴────────┴────────┴─────────┴─────────┘ │
│                                                                             │
│  [ ← Previous Week ]                                    [ Next Week → ]    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## URL Structure

```
Production URLs:
├── https://app.dudhwala.com        → Mobile PWA + Owner Web (same app)
├── https://admin.dudhwala.com      → Your Admin Panel (separate app)
└── https://api.dudhwala.com        → Backend API

Development URLs:
├── http://localhost:3000           → Mobile PWA + Owner Web
├── http://localhost:3001           → Admin Panel
└── http://localhost:4000           → Backend API
```

---

## Admin Panel (For YOU Only)

### Admin Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔐 DudhWala Admin                                        yourname@gmail.com │
├────────────────┬────────────────────────────────────────────────────────────┤
│                │                                                            │
│  📊 Dashboard  │   Admin Dashboard                                          │
│                │                                                            │
│  🏢 Businesses │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│                │   │  Total       │ │  Active      │ │  This Month  │      │
│  💰 Subscrip-  │   │  Businesses  │ │  Subscrip.   │ │  Revenue     │      │
│     tions      │   │              │ │              │ │              │      │
│                │   │     47       │ │     42       │ │  ₹12,450     │      │
│  📈 Revenue    │   └──────────────┘ └──────────────┘ └──────────────┘      │
│                │                                                            │
│  ⚠️ Alerts     │   ⚠️ Expiring Soon (7 days)                               │
│                │   ┌────────────────────────────────────────────────────┐  │
│                │   │ Business        │ Owner      │ Expires   │ Action  │  │
│                │   ├─────────────────┼────────────┼───────────┼─────────┤  │
│                │   │ Murugan Milk    │ 9876543210 │ Feb 10    │ [Extend]│  │
│                │   │ Rajan Dairy     │ 8765432109 │ Feb 12    │ [Extend]│  │
│                │   └────────────────────────────────────────────────────┘  │
│                │                                                            │
│                │   🔴 Expired (need attention)                              │
│                │   ┌────────────────────────────────────────────────────┐  │
│                │   │ Kumar Milk      │ 7654321098 │ Jan 25    │ [Extend]│  │
│                │   └────────────────────────────────────────────────────┘  │
│                │                                                            │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### Admin - Reset PIN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Reset PIN - Murugan Milk Supply                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Select User:                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ○  Murugan (Owner)     98765 43210                                 │   │
│  │  ●  Ravi (Staff)        87654 32109     ← Selected                  │   │
│  │  ○  Selvi (Staff)       87654 32108                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  New Temporary PIN:                                                         │
│  ┌────────────────────────────────┐                                         │
│  │  4521                          │   [ 🎲 Generate Random ]               │
│  └────────────────────────────────┘                                         │
│                                                                             │
│  [ Cancel ]                                    [ Reset PIN ]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Admin - Record Subscription Payment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Record Subscription Payment                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Business:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔍  Search business...                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Selected: Murugan Milk Supply (98765 43210)                               │
│  Current Status: Expired on Jan 15, 2025                                    │
│                                                                             │
│  Plan:                                                                      │
│  ○ Monthly    - ₹299   (30 days)                                           │
│  ○ Quarterly  - ₹799   (90 days)                                           │
│  ○ Half Yearly- ₹1499  (180 days)                                          │
│  ● Annual     - ₹2499  (365 days)    ← Selected                            │
│                                                                             │
│  Amount Received:  [ ₹2499 ]                                               │
│                                                                             │
│  Payment Method:   [ UPI ▼ ]                                               │
│                                                                             │
│  Transaction ID:   [ 402356789012 ]   (optional)                           │
│                                                                             │
│  Notes:            [ Annual renewal ]  (optional)                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────     │
│  Summary:                                                                   │
│  • Valid From: Feb 3, 2025                                                  │
│  • Valid Until: Feb 2, 2026                                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  [ Cancel ]                              [ Record Payment & Activate ]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
dudhwala/
│
├── apps/
│   │
│   ├── mobile-web/              # 📱 Main PWA (Mobile + Owner Web)
│   │   ├── src/
│   │   │   ├── components/      # Shared UI components
│   │   │   │   ├── ui/         # Base components (Button, Input, etc.)
│   │   │   │   ├── layout/     # AppShell, BottomNav, SideNav, Header
│   │   │   │   └── common/     # NumberPad, QuickSelect, etc.
│   │   │   │
│   │   │   ├── features/        # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── farmers/
│   │   │   │   ├── customers/
│   │   │   │   ├── collections/
│   │   │   │   ├── deliveries/
│   │   │   │   ├── payments/
│   │   │   │   └── reports/
│   │   │   │
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   │   ├── useOffline.ts
│   │   │   │   ├── useSync.ts
│   │   │   │   ├── useResponsive.ts  # Detect mobile/tablet/desktop
│   │   │   │   └── useAuth.ts
│   │   │   │
│   │   │   ├── services/        # API & business logic
│   │   │   │   ├── api.ts
│   │   │   │   ├── syncService.ts
│   │   │   │   └── reportService.ts
│   │   │   │
│   │   │   ├── db/              # IndexedDB (Dexie)
│   │   │   │   ├── localDb.ts
│   │   │   │   └── migrations.ts
│   │   │   │
│   │   │   ├── store/           # Zustand stores
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── appStore.ts
│   │   │   │   └── syncStore.ts
│   │   │   │
│   │   │   ├── i18n/            # Translations
│   │   │   │   ├── index.ts
│   │   │   │   └── locales/
│   │   │   │       ├── en.json
│   │   │   │       └── ta.json
│   │   │   │
│   │   │   ├── utils/           # Helper functions
│   │   │   │   ├── format.ts
│   │   │   │   ├── calculate.ts
│   │   │   │   └── validation.ts
│   │   │   │
│   │   │   ├── types/           # TypeScript types
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   │
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── manifest.json
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   │
│   └── admin-panel/             # 🔐 Admin Panel (YOUR dashboard)
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   └── layout/
│       │   │
│       │   ├── features/
│       │   │   ├── auth/           # Admin login (email + password)
│       │   │   ├── dashboard/      # Overview, stats
│       │   │   ├── businesses/     # List, view, manage businesses
│       │   │   ├── subscriptions/  # Record payments, extend
│       │   │   ├── users/          # Reset PINs
│       │   │   └── revenue/        # Revenue reports
│       │   │
│       │   ├── services/
│       │   │   └── adminApi.ts
│       │   │
│       │   ├── store/
│       │   │   └── adminAuthStore.ts
│       │   │
│       │   ├── App.tsx
│       │   └── main.tsx
│       │
│       ├── vite.config.ts
│       └── package.json
│
│
├── server/                      # 🖥️ Backend API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── setup.ts        # Initial admin setup (POST /api/setup/init-admin)
│   │   │   ├── admin/          # Admin panel routes
│   │   │   │   ├── auth.ts     # Admin login/logout
│   │   │   │   ├── businesses.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   └── users.ts    # PIN reset
│   │   │   │
│   │   │   ├── auth.ts         # App user auth (phone + PIN)
│   │   │   ├── business.ts
│   │   │   ├── farmers.ts
│   │   │   ├── customers.ts
│   │   │   ├── collections.ts
│   │   │   ├── deliveries.ts
│   │   │   ├── payments.ts
│   │   │   ├── reports.ts
│   │   │   └── sync.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts         # App user JWT validation
│   │   │   ├── adminAuth.ts    # Admin JWT validation
│   │   │   └── subscription.ts # Check subscription status
│   │   │
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── subscriptionService.ts
│   │   │   └── pinService.ts   # PIN hashing & verification
│   │   │
│   │   ├── utils/
│   │   │   ├── hash.ts         # bcrypt helpers
│   │   │   └── jwt.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── .env.example
│   └── package.json
│
│
├── packages/                    # Shared code (if using monorepo)
│   └── shared/
│       ├── types/              # Shared TypeScript types
│       └── constants/          # Shared constants
│
│
├── docker-compose.yml           # For local development
├── .gitignore
├── README.md
└── package.json                 # Root package.json (if monorepo)
├── public/
│   ├── icons/
│   └── screenshots/
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (Vite + React + TypeScript + Tailwind)
- [ ] PWA configuration
- [ ] IndexedDB setup with Dexie
- [ ] Base UI components
- [ ] i18n setup (English + Tamil)
- [ ] Authentication flow
- [ ] Basic offline detection

### Phase 2: Core Features (Week 3-4)
- [ ] Farmers CRUD
- [ ] Customers CRUD with subscriptions
- [ ] Collection entry (quick input)
- [ ] Delivery tracking
- [ ] Basic dashboard

### Phase 3: Payments & Balance (Week 5)
- [ ] Payment recording
- [ ] Balance calculations
- [ ] Farmer dues tracking
- [ ] Customer dues tracking

### Phase 4: Sync & Offline (Week 6)
- [ ] Offline queue implementation
- [ ] Sync service
- [ ] Conflict resolution
- [ ] Background sync

### Phase 5: Reports & Polish (Week 7-8)
- [ ] Daily summary report
- [ ] Farmer/Customer dues reports
- [ ] Export to PDF
- [ ] WhatsApp sharing
- [ ] UI polish and testing
- [ ] Performance optimization

### Phase 6: Multi-tenant & Scale (Week 9-10)
- [ ] Multi-business support
- [ ] Staff roles and permissions
- [ ] Business settings
- [ ] Data isolation

---

## Key Implementation Notes

### Offline-First Principles
1. **Write to IndexedDB first**, then sync to server
2. **Optimistic UI** - show success immediately, handle failures gracefully
3. **Queue all mutations** - never lose user data
4. **Last-write-wins** for conflict resolution (with timestamp)
5. **Clear sync status indicators** - user should always know sync state

### Performance Considerations
1. **Virtualized lists** for large farmer/customer lists
2. **Lazy load** feature modules
3. **Debounce** search inputs
4. **Index** frequently queried fields in IndexedDB
5. **Compress** images if receipt photos are added later

### Security
1. **PIN stored as bcrypt hash** on server
2. **JWT tokens** with short expiry + refresh tokens
3. **Business isolation** - all queries scoped to businessId
4. **Input validation** on both client and server
5. **HTTPS only** - required for service workers

### Testing Strategy
1. **Unit tests** for calculation utilities (rate lookup, balance calc)
2. **Integration tests** for sync service
3. **E2E tests** for critical flows (collection entry, delivery marking)
4. **Offline simulation** tests

---

## Quick Start Commands

```bash
# Frontend
npm create vite@latest milk-app -- --template react-ts
cd milk-app
npm install tailwindcss @headlessui/react zustand dexie react-hook-form zod react-i18next recharts
npm install -D vite-plugin-pwa

# Backend
mkdir server && cd server
npm init -y
npm install express prisma @prisma/client jsonwebtoken bcrypt cors helmet
npx prisma init
```

---

## Notes for Claude Code

When implementing this app:

1. **Start with the database schema** - run Prisma migrations first
2. **Build UI components** before features - ensures consistency
3. **Implement offline storage early** - it affects all feature implementations
4. **Test on actual mobile devices** - Chrome DevTools mobile simulation isn't enough for PWA testing
5. **Use Tamil translations from the start** - don't treat i18n as an afterthought

The app should feel native on Android - fast, responsive, and work without internet in rural areas where milkmen operate.
