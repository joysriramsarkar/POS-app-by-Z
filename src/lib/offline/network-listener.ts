// ============================================================================
// Network Listener - Active Online/Offline Status Monitoring
// Lakhan Bhandar POS - Automatic Sync on Reconnection
// ============================================================================

import { getSyncWorker } from './sync-worker';

export type NetworkStatus = 'online' | 'offline' | 'suspected';

interface NetworkStatusListener {
  (status: NetworkStatus): void;
}

/**
 * NETWORK LISTENER: Active monitoring of online/offline status
 * - Listens to navigator.onLine + window events
 * - Auto-triggers sync when connection restored
 * - Debounces rapid changes (bouncing network)
 */
export class NetworkStatusMonitor {
  private status: NetworkStatus = 'offline';
  private listeners: Set<NetworkStatusListener> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor() {
    this.initializeStatus();
    this.attachListeners();
  }

  /**
   * Initialize with current network status
   */
  private initializeStatus(): void {
    if (typeof navigator === 'undefined') {
      this.status = 'offline';
      return;
    }

    this.status = navigator.onLine ? 'online' : 'offline';
    console.log(`🌐 Network initialized as: ${this.status}`);
  }

  /**
   * ATTACH LISTENERS: Monitor both online/offline events
   */
  private attachListeners(): void {
    if (typeof window === 'undefined') return;

    // Online event
    window.addEventListener('online', () => {
      console.log('📶 Network event: online detected');
      this.handleStatusChange('online');
    });

    // Offline event
    window.addEventListener('offline', () => {
      console.log('📶 Network event: offline detected');
      this.handleStatusChange('offline');
    });

    // Periodic check (fallback, some browsers don't fire events reliably)
    setInterval(() => {
      const currentOnline = navigator.onLine;
      const expectedStatus = currentOnline ? 'online' : 'offline';

      if (expectedStatus !== this.status) {
        console.log(`📶 Periodic check detected status change: ${this.status} → ${expectedStatus}`);
        this.handleStatusChange(expectedStatus);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * HANDLE STATUS CHANGE: Debounce + trigger sync on online
   */
  private handleStatusChange(newStatus: NetworkStatus): void {
    // Debounce rapid changes (network bouncing)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (newStatus === this.status) return; // No actual change after debounce

      const oldStatus = this.status;
      this.status = newStatus;

      console.log(`🔄 Network status changed: ${oldStatus} → ${newStatus}`);

      // Notify all listeners
      for (const listener of this.listeners) {
        listener(newStatus);
      }

      // AUTO-SYNC on reconnection
      if (newStatus === 'online' && !this.isSyncing) {
        this.autoSync();
      }
    }, 1000); // Debounce for 1 second
  }

  /**
   * AUTO-SYNC: Triggered automatically when reconnected
   */
  private async autoSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping auto-sync');
      return;
    }

    this.isSyncing = true;
    console.log('🚀 Auto-sync triggered on network reconnection');

    try {
      const worker = await getSyncWorker();
      await worker.startSync();
    } catch (error) {
      console.error('Auto-sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * SUBSCRIBE: Listen to status changes
   */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * GET STATUS: Current network status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * IS ONLINE: Simple boolean check
   */
  isOnline(): boolean {
    return this.status === 'online';
  }

  /**
   * MANUAL SYNC: User-triggered sync (button click, etc.)
   */
  async manualSync(): Promise<void> {
    if (!this.isOnline()) {
      console.warn('⚠️  Cannot sync while offline');
      return;
    }

    if (this.isSyncing) {
      console.log('⏳ Sync already in progress');
      return;
    }

    console.log('👤 Manual sync requested');
    const worker = await getSyncWorker();
    await worker.startSync();
  }
}

// Singleton instance (create on module load)
let monitorInstance: NetworkStatusMonitor | null = null;

export function getNetworkMonitor(): NetworkStatusMonitor {
  if (!monitorInstance) {
    monitorInstance = new NetworkStatusMonitor();
  }
  return monitorInstance;
}

// Auto-initialize on browser load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    getNetworkMonitor();
  });
}
