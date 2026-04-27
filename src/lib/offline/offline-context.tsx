'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
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

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<{ synced: number; failed: number; total: number } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    let monitor: NetworkStatusMonitor | null = null;

    async function initialize() {
      try {
        monitor = new NetworkStatusMonitor();

        try {
          await getSyncWorker();
        } catch (syncError) {
          console.error('⚠️ Failed to initialize sync worker:', syncError);
        }

        const refreshCounts = async () => {
          try {
            const [unsynced, failed] = await Promise.all([
              SyncQueueDB.getUnsynced(),
              SyncQueueDB.getFailed(),
            ]);
            setPendingSyncCount(unsynced.length);
            setFailedSyncCount(failed.length);
          } catch (readError) {
            console.warn('Unable to read sync counts', readError);
          }
        };

        monitor.subscribe((status) => {
          setNetworkStatus(status);
          refreshCounts().catch(console.error);
          if (status === 'online') setLastSyncTime(new Date());
        });

        refreshCounts().catch(console.error);

        window.addEventListener('offlineSyncComplete', async (event: Event) => {
          const stats = (event as CustomEvent).detail;
          setSyncStats(stats);
          setIsSyncing(false);
          setLastSyncTime(new Date());
          refreshCounts().catch(console.error);
        });

        window.addEventListener('offlineSyncStart', () => setIsSyncing(true));

        // Session expired during sync — force logout
        window.addEventListener('syncSessionExpired', () => {
          setIsSyncing(false);
          signOut({ callbackUrl: '/login' });
        });

        setNetworkStatus(monitor.getStatus());
      } catch (error) {
        console.error('❌ Failed to initialize offline provider:', error);
        setNetworkStatus('offline');
      }
    }

    initialize();

    return () => {
      window.removeEventListener('offlineSyncComplete', () => {});
      window.removeEventListener('offlineSyncStart', () => {});
      window.removeEventListener('syncSessionExpired', () => {});
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline: networkStatus === 'online', networkStatus, isSyncing, syncStats }}>
      {children}
      {networkStatus === 'offline' && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          📴 Offline Mode - Changes saved locally
          <div className="text-xs mt-1 text-white/90">Pending sync: {pendingSyncCount}</div>
        </div>
      )}
      {isSyncing && (
        <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          🔄 Syncing data...
          <div className="text-xs mt-1 text-white/90">Pending: {pendingSyncCount}</div>
        </div>
      )}
      {failedSyncCount > 0 && !isSyncing && networkStatus === 'online' && (
        <div className="fixed bottom-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          ⚠️ {failedSyncCount} item{failedSyncCount > 1 ? 's' : ''} failed to sync
          <div className="text-xs mt-1 text-white/90">Go to Settings → Sync to resolve</div>
        </div>
      )}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineContext must be used within OfflineProvider');
  }
  return context;
}
