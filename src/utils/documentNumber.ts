import { Prisma } from "@prisma/client";
import dayjs from "dayjs";

export type CounterKey = "SALE" | "RETURN" | "PAYMENT";

/**
 * Indian financial year runs Apr 1 -> Mar 31. Counters reset per FY so
 * invoice numbers read e.g. INV/2025-26/0001.
 */
export const currentFinancialYear = (date: Date = new Date()): string => {
  const d = dayjs(date);
  const startYear = d.month() >= 3 ? d.year() : d.year() - 1; // month() is 0-indexed, 3 = April
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
};

/**
 * Atomically increments the counter row for (key, financialYear) and
 * returns the formatted document number. Must be called with a
 * transaction client so the increment is part of the caller's transaction
 * and safe under concurrent invoice creation.
 */
export const nextDocumentNumber = async (
  tx: Prisma.TransactionClient,
  key: CounterKey,
  prefix: string,
  date: Date = new Date(),
): Promise<string> => {
  const financialYear = currentFinancialYear(date);

  const counter = await tx.invoiceCounter.upsert({
    where: { key_financialYear: { key, financialYear } },
    create: { key, financialYear, prefix, currentNumber: 1 },
    update: { currentNumber: { increment: 1 }, prefix },
  });

  const padded = String(counter.currentNumber).padStart(4, "0");
  return `${prefix}/${financialYear}/${padded}`;
};
