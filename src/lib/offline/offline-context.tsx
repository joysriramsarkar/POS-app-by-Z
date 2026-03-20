// ============================================================================
// Offline Context Provider - Wire up offline functionality to UI
// Lakhan Bhandar POS
// ============================================================================

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetworkStatusMonitor, type NetworkStatus } from './network-listener';
import { getSyncWorker } from './sync-worker';

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
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<{ synced: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    let monitor: NetworkStatusMonitor | null = null;
    let syncWorker: Awaited<ReturnType<typeof getSyncWorker>> | null = null;

    async function initialize() {
      try {
        // Initialize network monitor
        monitor = new NetworkStatusMonitor();
        
        // Get sync worker (will auto-start sync when online)
        try {
          syncWorker = await getSyncWorker();
        } catch (syncError) {
          console.error('Failed to initialize sync worker:', syncError);
          // Continue anyway, sync will fail gracefully
        }

        // Listen to network status changes
        monitor.subscribe((status) => {
          console.log('📶 Network status updated:', status);
          setNetworkStatus(status);
        });

        // Listen to sync events
        window.addEventListener('offlineSyncComplete', (event: Event) => {
          const customEvent = event as CustomEvent;
          setSyncStats(customEvent.detail);
          setIsSyncing(false);
          console.log('✅ Sync completed:', customEvent.detail);
        });

        // Initial status
        setNetworkStatus(monitor.getStatus());
        console.log('🔧 Offline provider initialized');
      } catch (error) {
        console.error('Failed to initialize offline provider:', error);
        // Assume offline on startup if there's an error
        setNetworkStatus('offline');
      }
    }

    initialize();

    return () => {
      // Cleanup
      window.removeEventListener('offlineSyncComplete', () => {});
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
        </div>
      )}
      {isSyncing && (
        <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          🔄 Syncing data...
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
