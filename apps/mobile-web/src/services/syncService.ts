import { db, now } from '@/db/localDb'
import { useSyncStore } from '@/store'
import { syncApi } from './api'
import type { SyncQueueItem, SyncStatus } from '@/types'

class SyncService {
  private isProcessing = false

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue())
    }
  }

  // Add item to sync queue
  async queueSync(
    table: string,
    localId: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, unknown>
  ): Promise<void> {
    await db.syncQueue.add({
      table,
      localId,
      operation,
      data,
      status: 'pending',
      retryCount: 0,
      createdAt: now()
    })

    // Update pending count
    await this.updatePendingCount()

    // Try to process if online
    if (navigator.onLine) {
      this.processQueue()
    }
  }

  // Process pending items in queue
  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return

    this.isProcessing = true
    useSyncStore.getState().startSync()

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('createdAt')

      const total = pendingItems.length
      let processed = 0

      for (const item of pendingItems) {
        try {
          useSyncStore.getState().updateProgress(item.table, processed, total)

          // Mark as processing
          await db.syncQueue.update(item.id!, { status: 'processing' })

          // Sync item
          await this.syncItem(item)

          // Remove from queue on success
          await db.syncQueue.delete(item.id!)
          processed++
        } catch (error) {
          console.error('Sync error for item:', item, error)

          const newRetryCount = item.retryCount + 1
          if (newRetryCount >= 3) {
            await db.syncQueue.update(item.id!, {
              status: 'failed',
              retryCount: newRetryCount
            })
            useSyncStore.getState().setFailedCount(
              useSyncStore.getState().failedCount + 1
            )
          } else {
            await db.syncQueue.update(item.id!, {
              status: 'pending',
              retryCount: newRetryCount
            })
          }
        }
      }

      useSyncStore.getState().finishSync(true)
    } catch (error) {
      console.error('Queue processing error:', error)
      useSyncStore.getState().finishSync(false, String(error))
    } finally {
      this.isProcessing = false
      await this.updatePendingCount()
    }
  }

  // Sync a single item
  private async syncItem(item: SyncQueueItem): Promise<void> {
    let response: { success: boolean; data?: { result?: Record<string, unknown> } }

    switch (item.operation) {
      case 'create':
        response = await syncApi.push({
          table: item.table,
          operation: 'create',
          data: item.data
        }) as typeof response
        // After successful create, update local record with server ID
        if (response?.data?.result?.id) {
          await this.replaceLocalId(item.table, item.localId, response.data.result.id as string)
        }
        break
      case 'update':
        await syncApi.push({
          table: item.table,
          operation: 'update',
          data: item.data
        })
        break
      case 'delete':
        await syncApi.push({
          table: item.table,
          operation: 'delete',
          data: { id: item.data.id }
        })
        break
    }

    // Update local record sync status
    await this.updateLocalSyncStatus(item.table, item.localId, 'SYNCED')
  }

  // Replace local ID with server-generated ID to prevent duplicates on pull
  private async replaceLocalId(table: string, localId: string, serverId: string): Promise<void> {
    if (localId === serverId) return

    const getTable = (t: string) => {
      switch (t) {
        case 'farmers': return db.farmers
        case 'customers': return db.customers
        case 'collections': return db.collections
        case 'deliveries': return db.deliveries
        case 'payments': return db.payments
        default: return null
      }
    }

    const dbTable = getTable(table)
    if (!dbTable) return

    const record = await dbTable.get(localId)
    if (!record) return

    // Create new record with server ID, delete old local one
    await dbTable.put({ ...record, id: serverId, syncStatus: 'SYNCED' })
    await dbTable.delete(localId)
  }

  // Update sync status on local record
  private async updateLocalSyncStatus(
    table: string,
    localId: string,
    status: SyncStatus
  ): Promise<void> {
    switch (table) {
      case 'farmers': {
        const record = await db.farmers.where('localId').equals(localId).first()
        if (record) await db.farmers.update(record.id, { syncStatus: status })
        break
      }
      case 'customers': {
        const record = await db.customers.where('localId').equals(localId).first()
        if (record) await db.customers.update(record.id, { syncStatus: status })
        break
      }
      case 'collections': {
        const record = await db.collections.where('localId').equals(localId).first()
        if (record) await db.collections.update(record.id, { syncStatus: status })
        break
      }
      case 'deliveries': {
        const record = await db.deliveries.where('localId').equals(localId).first()
        if (record) await db.deliveries.update(record.id, { syncStatus: status })
        break
      }
      case 'payments': {
        const record = await db.payments.where('localId').equals(localId).first()
        if (record) await db.payments.update(record.id, { syncStatus: status })
        break
      }
    }
  }

  // Update pending count in store
  private async updatePendingCount(): Promise<void> {
    const pendingCount = await db.syncQueue
      .where('status')
      .equals('pending')
      .count()

    const failedCount = await db.syncQueue
      .where('status')
      .equals('failed')
      .count()

    useSyncStore.getState().setPendingCount(pendingCount)
    useSyncStore.getState().setFailedCount(failedCount)
  }

  // Full sync - process queue and pull changes
  async sync(): Promise<void> {
    // Capture lastSyncAt BEFORE processQueue, because processQueue calls
    // finishSync(true) which sets lastSyncAt to Date.now(). If we read it
    // after, pullChanges would ask the server for records updated after NOW,
    // which returns nothing.
    const lastSyncAt = useSyncStore.getState().lastSyncAt || 0
    await this.processQueue()
    await this.pullChanges(lastSyncAt)
  }

  // Retry failed items
  async retryFailed(): Promise<void> {
    await db.syncQueue
      .where('status')
      .equals('failed')
      .modify({ status: 'pending', retryCount: 0 })

    await this.updatePendingCount()
    this.processQueue()
  }

  // Clear all failed items
  async clearFailed(): Promise<void> {
    await db.syncQueue.where('status').equals('failed').delete()
    await this.updatePendingCount()
  }

  // Pull changes from server
  async pullChanges(sinceOverride?: number): Promise<void> {
    if (!navigator.onLine) return

    try {
      const lastSync = sinceOverride ?? (useSyncStore.getState().lastSyncAt || 0)
      const response = await syncApi.pull(lastSync) as {
        success: boolean
        data?: {
          farmers?: unknown[]
          customers?: unknown[]
          collections?: unknown[]
          deliveries?: unknown[]
          payments?: unknown[]
          farmerOrders?: unknown[]
          customerOrders?: unknown[]
        }
      }

      if (response.success && response.data) {
        // Merge server data with local data
        // This is a simple implementation - you may need conflict resolution
        const { farmers, customers, collections, deliveries, payments, farmerOrders, customerOrders } = response.data

        if (farmers) await this.mergeFarmers(farmers)
        if (customers) await this.mergeCustomers(customers)
        if (collections) await this.mergeCollections(collections)
        if (deliveries) await this.mergeDeliveries(deliveries)
        if (payments) await this.mergePayments(payments)
        if (farmerOrders) await this.mergeFarmerOrders(farmerOrders)
        if (customerOrders) await this.mergeCustomerOrders(customerOrders)
      }
    } catch (error) {
      console.error('Pull changes error:', error)
    }
  }

  // Helper to convert a date value (string or number) to a numeric timestamp
  private toTimestamp(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return new Date(value).getTime()
    return Date.now()
  }

  // Normalize a date value to YYYY-MM-DD format.
  // Server sends ISO datetime strings (e.g. "2025-02-09T00:00:00.000Z")
  // but frontend filters compare against plain date strings ("2025-02-09").
  private toDateString(value: unknown): string {
    if (typeof value === 'string') return value.slice(0, 10)
    return new Date().toISOString().slice(0, 10)
  }

  // Merge methods for each table type
  private async mergeFarmers(records: unknown[]): Promise<void> {
    for (const record of records as Array<Record<string, unknown>>) {
      const id = record.id as string
      const updatedAt = this.toTimestamp(record.updatedAt)
      const local = await db.farmers.get(id)

      // If no match by server ID, check for a local-created duplicate by phone
      if (!local && record.phone) {
        const allFarmers = await db.farmers.toArray()
        const duplicate = allFarmers.find(
          f => f.id.startsWith('local_') && f.data.phone === record.phone
        )
        if (duplicate) {
          await db.farmers.delete(duplicate.id)
        }
      }

      if (!local || updatedAt > local.updatedAt) {
        await db.farmers.put({
          id,
          localId: id,
          syncStatus: 'SYNCED',
          createdAt: this.toTimestamp(record.createdAt),
          updatedAt,
          data: {
            name: record.name as string,
            phone: record.phone as string | undefined,
            village: record.village as string | undefined,
            defaultRate: Number(record.defaultRate) || 0,
            isActive: record.isActive as boolean,
            balance: Number(record.balance) || 0
          }
        })
      }
    }
  }

  private async mergeCustomers(records: unknown[]): Promise<void> {
    for (const record of records as Array<Record<string, unknown>>) {
      const id = record.id as string
      const updatedAt = this.toTimestamp(record.updatedAt)
      const local = await db.customers.get(id)

      // If no match by server ID, check for a local-created duplicate by phone
      if (!local && record.phone) {
        const allCustomers = await db.customers.toArray()
        const duplicate = allCustomers.find(
          c => c.id.startsWith('local_') && c.data.phone === record.phone
        )
        if (duplicate) {
          await db.customers.delete(duplicate.id)
        }
      }

      if (!local || updatedAt > local.updatedAt) {
        await db.customers.put({
          id,
          localId: id,
          syncStatus: 'SYNCED',
          createdAt: this.toTimestamp(record.createdAt),
          updatedAt,
          data: {
            name: record.name as string,
            phone: record.phone as string | undefined,
            address: record.address as string | undefined,
            defaultRate: Number(record.defaultRate) || 0,
            subscriptionQtyAM: record.subscriptionQtyAM != null ? Number(record.subscriptionQtyAM) : undefined,
            subscriptionQtyPM: record.subscriptionQtyPM != null ? Number(record.subscriptionQtyPM) : undefined,
            isActive: record.isActive as boolean,
            balance: Number(record.balance) || 0
          }
        })
      }
    }
  }

  private async mergeCollections(records: unknown[]): Promise<void> {
    for (const record of records as Array<Record<string, unknown>>) {
      const id = record.id as string
      const updatedAt = this.toTimestamp(record.updatedAt)
      const local = await db.collections.get(id)
      if (!local || updatedAt > local.updatedAt) {
        await db.collections.put({
          id,
          localId: (record.localId as string) || id,
          syncStatus: 'SYNCED',
          createdAt: this.toTimestamp(record.createdAt),
          updatedAt,
          data: {
            farmerId: record.farmerId as string,
            date: this.toDateString(record.date),
            shift: record.shift as 'MORNING' | 'EVENING',
            quantity: Number(record.quantity) || 0,
            fatContent: record.fatContent != null ? Number(record.fatContent) : undefined,
            ratePerLiter: Number(record.ratePerLiter) || 0,
            totalAmount: Number(record.totalAmount) || 0,
            rateEditedAt: record.rateEditedAt as string | undefined,
            originalRate: record.originalRate != null ? Number(record.originalRate) : undefined,
            notes: record.notes as string | undefined
          }
        })
      }
    }
  }

  private async mergeDeliveries(records: unknown[]): Promise<void> {
    for (const record of records as Array<Record<string, unknown>>) {
      const id = record.id as string
      const updatedAt = this.toTimestamp(record.updatedAt)
      const local = await db.deliveries.get(id)
      if (!local || updatedAt > local.updatedAt) {
        await db.deliveries.put({
          id,
          localId: (record.localId as string) || id,
          syncStatus: 'SYNCED',
          createdAt: this.toTimestamp(record.createdAt),
          updatedAt,
          data: {
            customerId: record.customerId as string,
            date: this.toDateString(record.date),
            shift: record.shift as 'MORNING' | 'EVENING',
            quantity: Number(record.quantity) || 0,
            ratePerLiter: Number(record.ratePerLiter) || 0,
            totalAmount: Number(record.totalAmount) || 0,
            rateEditedAt: record.rateEditedAt as string | undefined,
            originalRate: record.originalRate != null ? Number(record.originalRate) : undefined,
            isSubscription: (record.isSubscription as boolean) || false,
            status: (record.status as 'DELIVERED' | 'SKIPPED' | 'CANCELLED') || 'DELIVERED',
            notes: record.notes as string | undefined
          }
        })
      }
    }
  }

  private async mergeFarmerOrders(records: unknown[]): Promise<void> {
    const typedRecords = records as Array<Record<string, unknown>>
    if (typedRecords.length === 0) return

    const userId = typedRecords[0].userId as string

    // Replace all farmer orders for this user with server data
    const existing = await db.farmerOrders.where('[userId]').equals([userId]).toArray()
    await db.farmerOrders.bulkDelete(existing.map((e) => e.id))

    await db.farmerOrders.bulkAdd(
      typedRecords.map((record) => ({
        id: record.id as string,
        localId: record.id as string,
        userId: record.userId as string,
        farmerId: record.farmerId as string,
        sortOrder: record.sortOrder as number
      }))
    )
  }

  private async mergeCustomerOrders(records: unknown[]): Promise<void> {
    const typedRecords = records as Array<Record<string, unknown>>
    if (typedRecords.length === 0) return

    const userId = typedRecords[0].userId as string

    // Replace all customer orders for this user with server data
    const existing = await db.customerOrders.where('[userId+shift]').above([userId]).toArray()
    // Filter to only this user's records
    const userRecords = existing.filter((e) => e.userId === userId)
    await db.customerOrders.bulkDelete(userRecords.map((e) => e.id))

    await db.customerOrders.bulkAdd(
      typedRecords.map((record) => ({
        id: record.id as string,
        localId: record.id as string,
        userId: record.userId as string,
        customerId: record.customerId as string,
        shift: record.shift as string | undefined,
        sortOrder: record.sortOrder as number
      }))
    )
  }

  private async mergePayments(records: unknown[]): Promise<void> {
    for (const record of records as Array<Record<string, unknown>>) {
      const id = record.id as string
      const createdAt = this.toTimestamp(record.createdAt)
      const local = await db.payments.get(id)
      if (!local || createdAt > local.createdAt) {
        await db.payments.put({
          id,
          localId: (record.localId as string) || id,
          syncStatus: 'SYNCED',
          createdAt,
          updatedAt: createdAt,
          data: {
            farmerId: record.farmerId as string | undefined,
            customerId: record.customerId as string | undefined,
            date: this.toDateString(record.date),
            amount: Number(record.amount) || 0,
            type: record.type as 'PAID_TO_FARMER' | 'RECEIVED_FROM_CUSTOMER' | 'ADVANCE_TO_FARMER' | 'ADVANCE_FROM_CUSTOMER',
            method: (record.method as 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER') || 'CASH',
            notes: record.notes as string | undefined
          }
        })
      }
    }
  }
}

export const syncService = new SyncService()
export default syncService
