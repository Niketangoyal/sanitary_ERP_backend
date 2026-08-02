-- AlterEnum
ALTER TYPE "AdvanceStatus" ADD VALUE 'PARTIALLY_ADJUSTED';

-- CreateTable
CREATE TABLE "advance_adjustments" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "salaryRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remainingBalanceAfter" DECIMAL(12,2) NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advance_adjustments_employeeId_idx" ON "advance_adjustments"("employeeId");

-- CreateIndex
CREATE INDEX "advance_adjustments_advanceId_idx" ON "advance_adjustments"("advanceId");

-- CreateIndex
CREATE INDEX "advance_adjustments_salaryRecordId_idx" ON "advance_adjustments"("salaryRecordId");

-- AddForeignKey
ALTER TABLE "advance_adjustments" ADD CONSTRAINT "advance_adjustments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "advance_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_adjustments" ADD CONSTRAINT "advance_adjustments_salaryRecordId_fkey" FOREIGN KEY ("salaryRecordId") REFERENCES "salary_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_adjustments" ADD CONSTRAINT "advance_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_adjustments" ADD CONSTRAINT "advance_adjustments_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
