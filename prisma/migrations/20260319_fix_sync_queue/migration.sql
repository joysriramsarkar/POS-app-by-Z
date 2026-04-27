-- Add missing columns to sync_queue table
-- These are critical for idempotency and result caching in the sync mechanism

-- Add idempotency_key column (unique for preventing duplicate syncs)
ALTER TABLE "sync_queue" ADD COLUMN "idempotency_key" TEXT;

-- Add result column (for caching results of successful syncs)
ALTER TABLE "sync_queue" ADD COLUMN "result" TEXT;

-- Create unique index on idempotency_key (used for upsert operations)
CREATE UNIQUE INDEX "sync_queue_idempotency_key_key" ON "sync_queue"("idempotency_key");

-- Create additional index for faster lookups
CREATE INDEX "sync_queue_entity_type_idx" ON "sync_queue"("entity_type");
