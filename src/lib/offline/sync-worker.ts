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
      return;
    }

    this.isRunning = true;

    // Fire sync start event so UI can show loading state
    this.notifyStart();

    try {
      let successCount = 0;
      let failureCount = 0;

      // Get pending sync items from SyncQueueDB
      const pendingItems = await SyncQueueDB.getUnsynced();

      if (pendingItems.length === 0) {
        this.notifyUI({ synced: 0, failed: 0, total: 0 });
        return;
      }

      for (const item of pendingItems) {
        // Skip permanently failed items
        if (item.retryCount >= 5) {
          await SyncQueueDB.markFailed(item.id, 'Max retries exceeded');
          failureCount++;
          continue;
        }

        try {
          const actionType = this.mapQueueItemToActionType(item);
          if (!actionType) {
            throw new Error(`Unsupported sync item: ${item.entityType}.${item.action}`);
          }

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

          // Session expired — stop sync and force re-login
          if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('syncSessionExpired'));
            this.notifyUI({ synced: successCount, failed: failureCount, total: pendingItems.length });
            return;
          }

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
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const newRetryCount = item.retryCount + 1;
          if (newRetryCount >= 5) {
            await SyncQueueDB.markFailed(item.id, errorMsg);
          } else {
            await SyncQueueDB.incrementRetry(item.id, errorMsg);
          }
          failureCount++;
        }
      }

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
      pending: allItems.filter((item) => !item.synced && !item.failed).length,
      processed: allItems.filter((item) => item.synced).length,
      failed: allItems.filter((item) => item.failed).length,
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
