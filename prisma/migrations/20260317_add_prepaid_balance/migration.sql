-- Add prepaid_balance column to customers table
-- This tracks prepaid/credit balance that customers have deposited with the store
ALTER TABLE "customers" ADD COLUMN "prepaid_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create index for faster queries on prepaid balance
CREATE INDEX "customers_prepaid_balance_idx" ON "customers"("prepaid_balance");
