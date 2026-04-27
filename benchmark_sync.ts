import { getSyncWorker } from './src/lib/offline/sync-worker';
import { SyncQueueDB } from './src/lib/offline/indexeddb';

async function main() {
  console.log("Setting up mock DB...");
  // We need to mock the environment since we can't run the browser worker easily in node.
}
main();
