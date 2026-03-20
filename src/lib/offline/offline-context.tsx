// ============================================================================
// Offline Context Provider - Wire up offline functionality to UI
// Lakhan Bhandar POS
// ============================================================================

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetworkStatusMonitor, type NetworkStatus } from './network-listener';
import { getSyncWorker } from './sync-worker';
import { SyncQueueDB } from './indexeddb';

interface OfflineContextType {
  isOnline: boolean;
  networkStatus: NetworkStatus;
  isSyncing: boolean;
  syncStats: { synced: number; failed: number; total: number } | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

/**
 * OFFLINE PROVIDER: Initialize and monitor offline/online state globally
 * Wrap your app in this provider to enable offline-first functionality
 * 
 * ⚠️ IMPORTANT: This is the ONLY sync manager. All sync requests go through:
 * - network-listener.ts detects network changes
 * - sync-worker.ts processes pending actions  
 * - page.tsx must NOT have its own sync loop
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<{ synced: number; failed: number; total: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    let monitor: NetworkStatusMonitor | null = null;
    let syncWorker: Awaited<ReturnType<typeof getSyncWorker>> | null = null;

    async function initialize() {
      try {
        // Initialize network monitor - this auto-triggers sync on reconnection
        monitor = new NetworkStatusMonitor();
        
        // Get sync worker (will auto-start sync when online)
        try {
          syncWorker = await getSyncWorker();
          console.log('✅ Sync worker initialized');
        } catch (syncError) {
          console.error('⚠️ Failed to initialize sync worker:', syncError);
          // Continue anyway, sync will fail gracefully
        }

        const refreshPendingCount = async () => {
          try {
            const unsynced = await SyncQueueDB.getUnsynced();
            setPendingSyncCount(unsynced.length);
          } catch (readError) {
            console.warn('Unable to read pending sync count', readError);
          }
        };

        // Listen to network status changes
        monitor.subscribe((status) => {
          console.log('📶 Network status updated:', status);
          setNetworkStatus(status);

          // update pending offline sync data count when connection changes
          refreshPendingCount().catch(console.error);

          // Mark sync start time when going online
          if (status === 'online') {
            setLastSyncTime(new Date());
            console.log('⏱️ Sync timer started');
          }
        });

        // Initialize pending sync count
        refreshPendingCount().catch(console.error);

        // Listen to sync events from sync-worker
        window.addEventListener('offlineSyncComplete', async (event: Event) => {
          const customEvent = event as CustomEvent;
          const stats = customEvent.detail;
          setSyncStats(stats);
          setIsSyncing(false);
          setLastSyncTime(new Date());
          console.log('✅ Sync completed with stats:', stats);
          const unsynced = await SyncQueueDB.getUnsynced();
          setPendingSyncCount(unsynced.length);
        });
        
        // Listen to sync start events
        window.addEventListener('offlineSyncStart', () => {
          setIsSyncing(true);
          console.log('🔄 Sync started...');
        });

        // Initial status
        const initialStatus = monitor.getStatus();
        setNetworkStatus(initialStatus);
        console.log('🔧 Offline provider initialized with status:', initialStatus);
      } catch (error) {
        console.error('❌ Failed to initialize offline provider:', error);
        // Assume offline on startup if there's an error
        setNetworkStatus('offline');
      }
    }

    initialize();

    return () => {
      // Cleanup
      window.removeEventListener('offlineSyncComplete', () => {});
      window.removeEventListener('offlineSyncStart', () => {});
    };
  }, []);

  const contextValue: OfflineContextType = {
    isOnline: networkStatus === 'online',
    networkStatus,
    isSyncing,
    syncStats,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      {/* Offline indicator in corner */}
      {networkStatus === 'offline' && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          📴 Offline Mode - Changes saved locally
          <div className="text-xs mt-1 text-white/90">
            Pending sync actions: {pendingSyncCount}
          </div>
        </div>
      )}
      {isSyncing && (
        <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          🔄 Syncing data...
          <div className="text-xs mt-1 text-white/90">
            Pending sync actions: {pendingSyncCount}
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  );
}

/**
 * Hook to access offline context in components
 */
export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineContext must be used within OfflineProvider');
  }
  return context;
}
