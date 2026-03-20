// ============================================================================
// Offline Sync Worker - Background Queue Processing Engine
// Lakhan Bhandar POS - Autonomous Sync with Idempotency & Retry
// ============================================================================

import { SyncQueueDB } from './indexeddb';
import type { SyncQueueItem } from '@/types/pos';

export interface SyncResult {
  success: boolean;
  idempotencyKey: string;
  data?: unknown;
  error?: string;
}

/**
 * SYNC WORKER: Processes offline sync items in background
 * - Runs on network reconnection
 * - Processes FIFO (oldest first)
 * - Auto-retries with exponential backoff
 */
export class OfflineSyncWorker {
  private isRunning = false;

  /**
   * START SYNC: Begin processing all pending actions
   * Safe to call multiple times (only runs once at a time)
   */
  async startSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Sync already running, skipping duplicate call');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting offline sync worker...');

    // Fire sync start event so UI can show loading state
    this.notifyStart();

    try {
      let successCount = 0;
      let failureCount = 0;

      // Get pending sync items from SyncQueueDB
      const pendingItems = await SyncQueueDB.getUnsynced();
      console.log(`📋 Found ${pendingItems.length} offline queued items to sync`);

      if (pendingItems.length === 0) {
        console.log('✅ No items to sync');
        this.notifyUI({ synced: 0, failed: 0, total: 0 });
        return;
      }

      for (const item of pendingItems) {
        try {
          // Prepare sync action type mapping
          const actionType = this.mapQueueItemToActionType(item);
          if (!actionType) {
            throw new Error(`Unsupported sync item: ${item.entityType}.${item.action}`);
          }

          // Parse payload from stored string
          const parsedPayload = JSON.parse(item.payload);

          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': item.id,
            },
            body: JSON.stringify({
              idempotencyKey: item.id,
              actionType,
              payload: parsedPayload,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText} ${text}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'Sync API returned failure');
          }

          await SyncQueueDB.markSynced(item.id);
          successCount++;
          console.log(`✅ Synced ${actionType}: queue item ${item.id}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          await SyncQueueDB.incrementRetry(item.id, errorMsg);
          failureCount++;
          console.error(`❌ Failed to sync queue item ${item.id}: ${errorMsg}`);
        }
      }

      console.log(`🏁 Sync complete: ${successCount} succeeded, ${failureCount} failed/retrying`);
      this.notifyUI({ synced: successCount, failed: failureCount, total: pendingItems.length });
    } finally {
      this.isRunning = false;
    }
  }

  private mapQueueItemToActionType(item: SyncQueueItem): string | null {
    if (item.entityType === 'Sale' && item.action === 'create') return 'sale:create';
    if (item.entityType === 'Customer' && item.action === 'create') return 'customer:create';
    if (item.entityType === 'Customer' && item.action === 'update') return 'customer:update';
    if (item.entityType === 'Product' && item.action === 'create') return 'product:create';
    if (item.entityType === 'Product' && item.action === 'update') {
      const payload = JSON.parse(item.payload);
      if (payload.quantityChange !== undefined) return 'product:stock:update';
      return 'product:update';
    }

    return null;
  }

  /**
   * GET QUEUE STATS: Dashboard health view
   */
  async getStats() {
    const allItems = await SyncQueueDB.getAll();
    const stats = {
      pending: allItems.filter((item) => !item.synced).length,
      processed: allItems.filter((item) => item.synced).length,
      failed: allItems.filter((item) => item.retryCount >= 5).length,
      total: allItems.length,
    };
    return stats;
  }

  /**
   * NOTIFY START: Emit sync start event  
   */
  private notifyStart(): void {
    const event = new CustomEvent('offlineSyncStart', { detail: {} });
    window.dispatchEvent(event);
  }

  /**
   * NOTIFY UI: Emit sync state change (for UI updates)
   */
  private notifyUI(stats: { synced: number; failed: number; total: number }): void {
    // Fire custom event that components can listen to
    const event = new CustomEvent('offlineSyncComplete', { detail: stats });
    window.dispatchEvent(event);

    // Also update localStorage with status
    localStorage.setItem(
      'offline-sync-status',
      JSON.stringify({
        lastSyncAt: Date.now(),
        stats,
      })
    );
  }

}

// Singleton instance
let workerInstance: OfflineSyncWorker | null = null;

export async function getSyncWorker(): Promise<OfflineSyncWorker> {
  if (!workerInstance) {
    workerInstance = new OfflineSyncWorker();
  }
  return workerInstance;
}
