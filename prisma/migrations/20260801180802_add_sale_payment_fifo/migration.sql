/*
  Warnings:

  - Added the required column `balanceDue` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `saleType` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('CASH', 'BILL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PARTIAL');

-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "saleId" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "costOfGoods" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "balanceDue" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "paymentMethod" "PaymentMode",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "saleType" "SaleType" NOT NULL;

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "quantityRemaining" DECIMAL(12,2) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_consumptions" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "batch_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_batches_productId_purchaseDate_idx" ON "stock_batches"("productId", "purchaseDate");

-- CreateIndex
CREATE INDEX "batch_consumptions_saleItemId_idx" ON "batch_consumptions"("saleItemId");

-- CreateIndex
CREATE INDEX "batch_consumptions_batchId_idx" ON "batch_consumptions"("batchId");

-- CreateIndex
CREATE INDEX "payments_saleId_idx" ON "payments"("saleId");

-- CreateIndex
CREATE INDEX "sales_paymentStatus_idx" ON "sales"("paymentStatus");

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_consumptions" ADD CONSTRAINT "batch_consumptions_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_consumptions" ADD CONSTRAINT "batch_consumptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
