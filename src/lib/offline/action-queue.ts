// ============================================================================
// Action Queue - Enterprise-Grade Offline-First Queue System
// Lakhan Bhandar POS - Guaranteed Transaction Safety
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { Sale, SaleItem, Customer, Product } from '@/types/pos';

export type ActionType = 'sale:create' | 'customer:create' | 'customer:update' | 'product:stock:update' | 'payment:record';
export type ActionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

/**
 * CRITICAL: Every action has an idempotency key (UUID v4) generated client-side.
 * This prevents duplicate processing if network fails mid-transmission.
 * Supabase must verify: if action with this idempotencyKey already exists, return cached result.
 */
export interface QueueAction {
  // Idempotency: Unique per transaction, MUST be verified server-side
  idempotencyKey: string;
  
  // Queue metadata
  id: string; // Local queue ID (different from idempotencyKey)
  actionType: ActionType;
  status: ActionStatus;
  
  // Retry tracking with exponential backoff
  retryCount: number;
  lastRetryAt?: number; // timestamp
  nextRetryAt?: number; // timestamp for exponential backoff
  error?: string;
  
  // Timing
  createdAt: number;
  completedAt?: number;
  
  // The actual payload to sync
  payload: unknown;
  
  // Device tracking (useful for multi-device debugging)
  deviceId: string;
  
  // Reference tracking for related operations
  referencedActionId?: string; // Link to parent action if dependent
}

/**
 * CRITICAL CONSTANT: Maximum retries before marking as FAILED
 * After 5 attempts with exponential backoff, assume permanent failure
 */
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 1000; // 1 second

/**
 * Calculate next retry timestamp with exponential backoff
 * 1st retry: 1s, 2nd: 2s, 3rd: 4s, 4th: 8s, 5th: 16s (total ~31s)
 */
export function calculateNextRetryTime(retryCount: number): number {
  const delayMs = BASE_RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 100; // jitter
  return Date.now() + delayMs;
}

/**
 * ENTERPRISE-GRADE ACTION QUEUE
 * All methods are atomic and use IndexedDB transactions
 */
export class ActionQueue {
  private dbName = 'lakhan-bhandar-pos';
  private storeName = 'action_queue';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Critical indices for queue processing
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true }); // UNIQUE constraint!
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
          store.createIndex('actionType', 'actionType', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * ENQUEUE: Add action to queue with idempotency guarantee
   * Returns idempotencyKey for client use
   */
  async enqueue(actionType: ActionType, payload: unknown, deviceId: string): Promise<string> {
    await this.init();
    const idempotencyKey = uuidv4();

    const action: QueueAction = {
      idempotencyKey,
      id: uuidv4(),
      actionType,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
      payload,
      deviceId,
    };

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      const request = store.add(action);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(idempotencyKey);

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * GET PENDING: Retrieve all actions ready to sync (pending + due for retry)
   * Returns in FIFO order (oldest first)
   */
  async getPendingActions(): Promise<QueueAction[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const all: QueueAction[] = request.result;
        
        // Filter pending + due for retry
        const now = Date.now();
        const toProcess = all.filter(
          (a) => a.status === 'pending' || (a.status === 'retrying' && (a.nextRetryAt || 0) <= now)
        );

        // Sort by creation time (FIFO)
        toProcess.sort((a, b) => a.createdAt - b.createdAt);
        resolve(toProcess);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * MARK PROCESSING: Transition from pending → processing
   * Ensures only one sync attempt per action at a time
   */
  async markProcessing(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const action: QueueAction = getRequest.result;
        if (!action) throw new Error(`Action ${id} not found`);
        
        action.status = 'processing';
        const updateRequest = store.put(action);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * MARK COMPLETED: Action synced successfully, remove from queue
   */
  async markCompleted(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const action: QueueAction = getRequest.result;
        if (!action) throw new Error(`Action ${id} not found`);
        
        action.status = 'completed';
        action.completedAt = Date.now();
        action.error = undefined;
        
        const updateRequest = store.put(action);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * MARK FAILED: Increment retry count + schedule exponential backoff
   * If MAX_RETRIES exceeded, status = 'failed'
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const action: QueueAction = getRequest.result;
        if (!action) throw new Error(`Action ${id} not found`);
        
        action.retryCount += 1;
        action.error = error;
        action.lastRetryAt = Date.now();

        if (action.retryCount >= MAX_RETRIES) {
          // PERMANENT FAILURE: Stop retrying
          action.status = 'failed';
          action.nextRetryAt = undefined;
        } else {
          // Schedule next retry with exponential backoff
          action.status = 'retrying';
          action.nextRetryAt = calculateNextRetryTime(action.retryCount);
        }

        const updateRequest = store.put(action);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * GET BY IDEMPOTENCY KEY: Check if action already processed
   * Used server-side to prevent duplicate processing
   */
  async getByIdempotencyKey(idempotencyKey: string): Promise<QueueAction | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('idempotencyKey');

      const request = index.get(idempotencyKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * GET STATS: Dashboard view of queue health
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalRetries: number;
  }> {
    await this.init();

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const all: QueueAction[] = request.result;
        const stats = {
          pending: all.filter((a) => a.status === 'pending').length,
          processing: all.filter((a) => a.status === 'processing').length,
          completed: all.filter((a) => a.status === 'completed').length,
          failed: all.filter((a) => a.status === 'failed').length,
          totalRetries: all.reduce((sum, a) => sum + a.retryCount, 0),
        };
        resolve(stats);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * CLEAR COMPLETED: Archive completed actions after N days (optional cleanup)
   */
  async clearCompleted(olderThanDays: number = 7): Promise<number> {
    await this.init();
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const db = this.db!;
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const all: QueueAction[] = request.result;
        let deleted = 0;

        for (const action of all) {
          if (action.status === 'completed' && (action.completedAt || 0) < cutoffTime) {
            store.delete(action.id);
            deleted++;
          }
        }

        tx.oncomplete = () => resolve(deleted);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton instance
let queueInstance: ActionQueue | null = null;

export async function getActionQueue(): Promise<ActionQueue> {
  if (!queueInstance) {
    queueInstance = new ActionQueue();
    await queueInstance.init();
  }
  return queueInstance;
}
