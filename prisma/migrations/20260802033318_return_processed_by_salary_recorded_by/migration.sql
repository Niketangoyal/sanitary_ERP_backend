-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "processedById" TEXT;

-- AlterTable: add nullable first so we can backfill existing rows
ALTER TABLE "salary_payments" ADD COLUMN     "recordedById" TEXT;

-- Backfill existing salary_payments rows with the first admin user
UPDATE "salary_payments"
SET "recordedById" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "recordedById" IS NULL;

-- Now enforce NOT NULL going forward
ALTER TABLE "salary_payments" ALTER COLUMN "recordedById" SET NOT NULL;

-- CreateIndex
CREATE INDEX "returns_saleId_idx" ON "returns"("saleId");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
