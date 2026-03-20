-- AlterTable
ALTER TABLE "sales" ADD COLUMN "user_id" TEXT;

-- CreateIndex
CREATE INDEX "sales_user_id_idx" ON "sales"("user_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
