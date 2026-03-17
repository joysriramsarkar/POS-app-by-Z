// ============================================================================
// Offline Sync Worker - Background Queue Processing Engine
// Lakhan Bhandar POS - Autonomous Sync with Idempotency & Retry
// ============================================================================

import { getActionQueue, type QueueAction } from './action-queue';
import type { Sale, Customer, Product } from '@/types/pos';

export interface SyncResult {
  success: boolean;
  idempotencyKey: string;
  data?: unknown;
  error?: string;
}

/**
 * SYNC WORKER: Processes action queue in background
 * - Runs on network reconnection
 * - Processes FIFO (oldest first)
 * - Each item must complete before next starts (no race conditions)
 * - Auto-retries with exponential backoff
 */
export class OfflineSyncWorker {
  private isRunning = false;
  private queue = getActionQueue();

  /**
   * START SYNC: Begin processing all pending actions
   * Safe to call multiple times (only runs once at a time)
   */
  async startSync(): Promise<void> {
    if (this.isRunning) {
      console.log('Sync already running, skipping duplicate call');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting offline sync worker...');

    try {
      const queue = await this.queue;
      let successCount = 0;
      let failureCount = 0;

      // FIFO processing: Get all pending actions
      const pendingActions = await queue.getPendingActions();
      console.log(`📋 Found ${pendingActions.length} actions to sync`);

      for (const action of pendingActions) {
        try {
          // Mark as processing to prevent concurrent attempts
          await queue.markProcessing(action.id);
          console.log(`⏳ Processing ${action.actionType}: ${action.idempotencyKey}`);

          // Send to server with idempotency key
          const result = await this.syncAction(action);

          if (result.success) {
            await queue.markCompleted(action.id);
            console.log(`✅ Synced ${action.actionType}: ${action.idempotencyKey}`);
            successCount++;
          } else {
            // Server rejected our data (validation error, etc.)
            await queue.markFailed(action.id, result.error || 'Unknown error');
            console.error(`❌ Failed to sync ${action.actionType}: ${result.error}`);
            failureCount++;
          }
        } catch (error) {
          // Network error, transient failure, will retry later
          const errorMsg = error instanceof Error ? error.message : String(error);
          await queue.markFailed(action.id, errorMsg);
          console.error(`⚠️  Sync error for ${action.actionType}: ${errorMsg}`);
          failureCount++;
        }
      }

      console.log(
        `🏁 Sync complete: ${successCount} succeeded, ${failureCount} failed/retrying`
      );

      // Notify UI of sync completion
      this.notifyUI({
        synced: successCount,
        failed: failureCount,
        total: pendingActions.length,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * SYNC ACTION: Send single action to server with idempotency key
   */
  private async syncAction(action: QueueAction): Promise<SyncResult> {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // CRITICAL: Pass idempotency key so server can detect duplicates
        'X-Idempotency-Key': action.idempotencyKey,
      },
      body: JSON.stringify({
        idempotencyKey: action.idempotencyKey,
        actionType: action.actionType,
        payload: action.payload,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        idempotencyKey: action.idempotencyKey,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    return {
      success: result.success === true,
      idempotencyKey: action.idempotencyKey,
      data: result.data,
      error: result.error,
    };
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

  /**
   * GET QUEUE STATS: Dashboard health view
   */
  async getStats() {
    const queue = await this.queue;
    return queue.getStats();
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
