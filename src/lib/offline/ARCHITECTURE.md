// ============================================================================
// OFFLINE-FIRST ARCHITECTURE INTEGRATION GUIDE
// Lakhan Bhandar POS - How to Implement Enterprise-Grade Offline-First
// ============================================================================

/*

## ARCHITECTURE OVERVIEW

This document explains the complete offline-first system and how to integrate
it into your existing POS application.

### 1. ACTION QUEUE SYSTEM (action-queue.ts)
---

Core: IndexedDB-backed queue that stores every POS transaction before syncing

Key Features:
- Idempotency Keys (UUID v4) → Prevents duplicate processing
- Exponential Backoff → Smart retry on network failure
- FIFO Processing → Actions complete in order
- Atomic Operations → No partial updates

Data Flow:
┌─────────────────────────────────┐
│  Checkout Dialog (React)         │
│  - Generate Sale (local ID)      │
│  - Save to IndexedDB             │
│  - Update UI immediately ✨      │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ActionQueue.enqueue()               │
│  - Create idempotencyKey (UUID v4)  │
│  - Insert into action_queue store   │
│  - Return with promise              │
└──────────────┬──────────────────────┘
               │ (FIFO, on background)
               ▼
┌──────────────────────────────────────┐
│  OfflineSyncWorker.startSync()       │
│  - Fetch all pending actions         │
│  - Send each to /api/sync            │
│  - Pass X-Idempotency-Key header    │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  /api/sync POST handler              │
│  - Verify idempotencyKey is unique   │
│  - Process (create sale, update DB)  │
│  - Cache result for future retries   │
│  - Return success/error              │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ActionQueue.markCompleted() or      │
│  ActionQueue.markFailed() + retry    │
│  - Update local queue status         │
│  - Schedule exponential backoff      │
└──────────────────────────────────────┘


### 2. LOCAL-FIRST CHECKOUT (local-first-checkout.ts)
---

Integration Pattern:

// OLD (NETWORK-FIRST, WRONG):
async handleCheckout() {
  setLoading(true);
  try {
    const response = await fetch('/api/sales', { method: 'POST', body: ... });
    const sale = await response.json();
    
    // UI only updates after network completes!
    setSale(sale);
    clearCart();
    showSuccess();
  } finally {
    setLoading(false);
  }
}

// NEW (LOCAL-FIRST, CORRECT):
async handleCheckout() {
  try {
    // 1. Save to IndexedDB + queue IMMEDIATELY
    const sale = await LocalFirstCheckout.executeSale(
      items,
      customerId,
      paymentMethod,
      amountPaid,
      discount,
      tax,
      notes,
      getDeviceId()
    );
    
    // 2. Update UI immediately with local sale
    setSale(sale);
    clearCart(); // From Zustand (localStorage)
    showSuccess(); // No network wait!
    
    // 3. Sync in background (fire and forget)
    // Network listener will auto-trigger when online
    
  } catch (error) {
    // Handle validation errors only (not network errors)
    showError(error.message);
  }
}


### 3. NETWORK LISTENER (network-listener.ts)
---

Auto-triggers sync when device comes online

Usage in Component:

import { useEffect } from 'react';
import { getNetworkMonitor } from '@/lib/offline';

export function SyncIndicator() {
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    const monitor = getNetworkMonitor();
    
    // Subscribe to changes
    const unsubscribe = monitor.subscribe((newStatus) => {
      setStatus(newStatus);
      // Auto-sync triggers automatically!
    });

    return unsubscribe;
  }, []);

  return (
    <div className={status === 'online' ? 'bg-green-500' : 'bg-red-500'}>
      {status === 'online' ? '🌐 Online' : '📡 Offline'}
    </div>
  );
}


### 4. SYNC WORKER (sync-worker.ts)
---

Background processing engine with idempotency

Key Properties:
- FIFO: Processes oldest actions first
- Blocking: Waits for each action to complete before next
- Idempotent: Server caches results by idempotencyKey
- Retry-Safe: Failed items stay in queue, retry on next online event

Usage:

import { getSyncWorker } from '@/lib/offline';

async function manualSync() {
  const worker = await getSyncWorker();
  await worker.startSync();
  
  const stats = await worker.getStats();
  console.log(`${stats.pending} pending, ${stats.completed} completed`);
}


### 5. IDEMPOTENCY ON THE SERVER (/api/sync)
---

CRITICAL: Server must check idempotencyKey before processing

The header "X-Idempotency-Key" contains the UUID v4 from client

Implementation Pattern:

POST /api/sync {
  X-Idempotency-Key: "550e8400-e29b-41d4-a716-446655440000"
  
  Body:
  {
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    actionType: "sale:create",
    payload: { id, invoiceNumber, items, ... }
  }
}

Server Flow:
1. Extract idempotencyKey from header
2. Check if SyncQueue record exists with this key
3. If exists AND synced=true → Return cached result
4. If not exists → Process, then store in SyncQueue
5. If exists AND synced=false → Reject (duplicate in-flight)


### 6. EXPONENTIAL BACKOFF STRATEGY
---

Retry Delays (with jitter):
- 1st attempt: immediate
- 1st retry: ~1 second
- 2nd retry: ~2 seconds  
- 3rd retry: ~4 seconds
- 4th retry: ~8 seconds
- 5th retry: ~16 seconds
- Total: ~31 seconds, then FAIL (marked 'failed' status)

Failed items can be manually retried via admin panel


### 7. OFFLINE SECURITY CONSIDERATIONS
---

1. Encryption at Rest:
   - IndexedDB is device-local (browser sandbox)
   - For high-security: Encrypt sensitive fields before saving
   
2. Data Validation:
   - Client-side validation before queuing
   - Server-side re-validation before commitment
   
3. Duplicate Prevention:
   - idempotencyKey ensures each sale has unique UUID
   - invoiceNumber ensures readable uniqueness
   - SQL constraints prevent duplicates at DB level

4. Audit Trail:
   - All synced actions logged in SyncQueue
   - Failed actions tracked with retry count + error message
   - Can query history: db.syncQueue.findMany({ where: { entityType: 'sale:create' } })


### 8. DATABASE SCHEMA UPDATES
---

Add to Prisma SyncQueue model:

model SyncQueue {
  id               String    @id @default(cuid())
  idempotencyKey   String    @unique  // ← CRITICAL: UUID v4
  entityType       String
  result           String?   // ← JSON result cache
  // ... existing fields
}

Run Migration:
npx prisma migrate dev --name add_idempotency_and_result


### 9. INTEGRATION CHECKLIST
---

□ Create action-queue.ts
□ Create sync-worker.ts
□ Create network-listener.ts  
□ Create local-first-checkout.ts
□ Update SyncQueue Prisma model (add idempotencyKey, result)
□ Update /api/sync POST handler (idempotency verification)
□ Update CheckoutDialog to use LocalFirstCheckout.executeSale()
□ Add NetworkStatusMonitor to app root component
□ Update CartStore if using localStorage (already compatible)
□ Add offline indicator UI component
□ Test offline flow: create sale → go offline → come online → verify sync
□ Test network failure: create sale → simulate 503 error → verify retry
□ Test duplicate prevention: send same request twice, verify idempotency


### 10. TESTING STRATEGY
---

Unit Tests:
- ActionQueue.enqueue() → Creates unique idempotencyKeys
- ActionQueue.markFailed() → Calculates exponential backoff correctly
- NetworkStatusMonitor.subscribe() → Fires events on status change

Integration Tests:
- Create sale offline → Verify in IndexedDB
- Come online → Verify auto-sync triggered
- Simulate 500 error → Verify retry scheduled
- Send duplicate request → Verify server returns cached result

E2E Tests (Playwright/Cypress):
- User flow: Add product → Checkout → Go offline → Come online
- Verify sale appears in receipt history immediately (offline)
- Verify sale syncs to Supabase when online
- View sync status in admin panel


### 11. DEBUGGING
---

Check Queue Status:
const queue = await getActionQueue();
const stats = await queue.getStats();
console.log('Queue Status:', stats);

Get Pending Actions:
const queue = await getActionQueue();
const pending = await queue.getPendingActions();
console.log('Pending Sync:', pending);

Monitor Network:
const monitor = getNetworkMonitor();
monitor.subscribe((status) => {
  console.log('Network:', status);
});

Clear Queue (admin only):
const queue = await getActionQueue();
const deleted = await queue.clearCompleted(0); // Clear all
console.log(`Cleared ${deleted} items`);


### 12. PERFORMANCE CONSIDERATIONS
---

- IndexedDB queries are synchronous-ish (async API but very fast)
- Keep IndexedDB transactions short (< 100ms ideal)
- Batch multiple items into single transaction when possible
- Compress large payloads before queueing
- Archive old synced items (older than 7 days) to prevent DB bloat


### 13. MULTI-DEVICE SCENARIOS
---

With deviceId tracking, you can support:
- Multiple tills in one shop
- Each device maintains its own queue
- Server reconciles via invoiceNumber + timestamp
- Dashboard shows per-device sync status


=============================================================================

IMMEDIATE NEXT STEPS:

1. Update CheckoutDialog.tsx to use LocalFirstCheckout.executeSale()
2. Add NetworkStatusMonitor initialization to app root
3. Run: npx prisma migrate dev
4. Test complete offline → online flow
5. Monitor network tab during offline + reconnect

=============================================================================

*/

// This file serves as documentation. The actual implementation is in:
// - action-queue.ts          → Core queue with idempotency
// - sync-worker.ts            → Background sync processing
// - network-listener.ts       → Online/offline monitoring
// - local-first-checkout.ts   → UI integration layer
// - /api/sync                 → Server idempotency handler
