import Dexie, { type Table } from 'dexie'
import type {
  LocalFarmer,
  LocalCustomer,
  LocalCollection,
  LocalDelivery,
  LocalPayment,
  LocalRate,
  SyncQueueItem,
  UserFarmerOrder,
  UserCustomerOrder,
  Route,
  UserRoute,
  RouteFarmer,
  RouteCustomer
} from '@/types'

class MilkmenDB extends Dexie {
  farmers!: Table<LocalFarmer>
  customers!: Table<LocalCustomer>
  collections!: Table<LocalCollection>
  deliveries!: Table<LocalDelivery>
  payments!: Table<LocalPayment>
  rates!: Table<LocalRate>
  farmerOrders!: Table<UserFarmerOrder>
  customerOrders!: Table<UserCustomerOrder>
  syncQueue!: Table<SyncQueueItem>
  routes!: Table<Route>
  userRoutes!: Table<UserRoute>
  routeFarmers!: Table<RouteFarmer>
  routeCustomers!: Table<RouteCustomer>

  constructor() {
    super('milkmen')

    this.version(1).stores({
      // Primary key is 'id', with indexes on localId, syncStatus, updatedAt
      farmers: 'id, localId, syncStatus, updatedAt, [data.isActive]',
      customers: 'id, localId, syncStatus, updatedAt, [data.isActive]',
      collections: 'id, localId, syncStatus, [data.farmerId+data.date], [data.date], updatedAt',
      deliveries: 'id, localId, syncStatus, [data.customerId+data.date], [data.date], [data.status], updatedAt',
      payments: 'id, localId, syncStatus, [data.farmerId], [data.customerId], [data.date], updatedAt',
      rates: 'id, localId, syncStatus, [data.farmerId]',
      farmerOrders: 'id, localId, [userId+farmerId], [userId]',
      customerOrders: 'id, localId, [userId+customerId+shift], [userId+shift]',
      syncQueue: '++id, table, localId, status, createdAt'
    })

    this.version(2).stores({
      farmers: 'id, localId, syncStatus, updatedAt, [data.isActive]',
      customers: 'id, localId, syncStatus, updatedAt, [data.isActive]',
      collections: 'id, localId, syncStatus, [data.farmerId+data.date], [data.date], updatedAt',
      deliveries: 'id, localId, syncStatus, [data.customerId+data.date], [data.date], [data.status], updatedAt',
      payments: 'id, localId, syncStatus, [data.farmerId], [data.customerId], [data.date], updatedAt',
      rates: 'id, localId, syncStatus, [data.farmerId]',
      farmerOrders: 'id, localId, [userId+farmerId], [userId]',
      customerOrders: 'id, localId, [userId+customerId+shift], [userId+shift]',
      syncQueue: '++id, table, localId, status, createdAt',
      routes: 'id, businessId, isActive',
      userRoutes: 'id, userId, routeId',
      routeFarmers: 'id, routeId, farmerId',
      routeCustomers: 'id, routeId, customerId'
    })
  }
}

export const db = new MilkmenDB()

// Helper to generate local IDs
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Helper to get current timestamp
export function now(): number {
  return Date.now()
}

// Clear all data (for logout)
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
  })
}

// Export database for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { milkmenDb: MilkmenDB }).milkmenDb = db
}
