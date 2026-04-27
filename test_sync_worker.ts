import { test, expect, mock, spyOn } from "bun:test";
import { OfflineSyncWorker } from "./src/lib/offline/sync-worker";
import { SyncQueueDB } from "./src/lib/offline/indexeddb";

test("benchmark sync worker", async () => {
  const worker = new OfflineSyncWorker();
  const mockItems = Array.from({ length: 50 }).map((_, i) => ({
    id: `item-${i}`,
    entityType: 'Sale',
    action: 'create',
    payload: JSON.stringify({ items: [] }),
    retryCount: 0,
    synced: false,
    failed: false,
  }));

  spyOn(SyncQueueDB, "getUnsynced").mockResolvedValue(mockItems as any);
  spyOn(SyncQueueDB, "markSynced").mockResolvedValue(undefined as any);
  spyOn(SyncQueueDB, "markFailed").mockResolvedValue(undefined as any);
  spyOn(SyncQueueDB, "incrementRetry").mockResolvedValue(undefined as any);

  let fetchCount = 0;
  global.fetch = mock(async () => {
    fetchCount++;
    // Simulate network delay
    await new Promise(r => setTimeout(r, 10));
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  }) as any;

  // mock window events and localStorage
  global.window = {
    dispatchEvent: () => {},
  } as any;
  global.localStorage = {
    setItem: () => {},
  } as any;
  global.CustomEvent = class CustomEvent {
    constructor() {}
  } as any;

  const start = performance.now();
  await worker.startSync();
  const end = performance.now();

  console.log(`Took ${end - start}ms to sync 50 items`);
  console.log(`Fetch called ${fetchCount} times`);
});
