import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const ledgerRepository = {
  findLastEntry: (tx: Prisma.TransactionClient, customerId: string) =>
    tx.ledgerEntry.findFirst({
      where: { customerId },
      orderBy: { sequence: "desc" },
    }),

  create: (tx: Prisma.TransactionClient, data: Prisma.LedgerEntryUncheckedCreateInput) =>
    tx.ledgerEntry.create({ data }),

  /** Latest running balances for a customer, or zero if no ledger history yet. */
  getCurrentBalances: async (customerId: string) => {
    const last = await prisma.ledgerEntry.findFirst({
      where: { customerId },
      orderBy: { sequence: "desc" },
    });
    return {
      cashBalance: last ? Number(last.cashBalanceAfter) : 0,
      billBalance: last ? Number(last.billBalanceAfter) : 0,
    };
  },

  getCurrentBalancesForMany: async (customerIds: string[]) => {
    if (customerIds.length === 0) return new Map<string, { cashBalance: number; billBalance: number }>();

    // Prisma has no "latest row per group" query builder, so this is raw SQL
    // using DISTINCT ON — the standard Postgres idiom for that access pattern.
    const rows = await prisma.$queryRaw<
      { customerId: string; cashBalanceAfter: Prisma.Decimal; billBalanceAfter: Prisma.Decimal }[]
    >`
      SELECT DISTINCT ON ("customerId") "customerId", "cashBalanceAfter", "billBalanceAfter"
      FROM "ledger_entries"
      WHERE "customerId" = ANY(${customerIds})
      ORDER BY "customerId", "sequence" DESC
    `;

    const map = new Map<string, { cashBalance: number; billBalance: number }>();
    for (const id of customerIds) map.set(id, { cashBalance: 0, billBalance: 0 });
    for (const row of rows) {
      map.set(row.customerId, {
        cashBalance: Number(row.cashBalanceAfter),
        billBalance: Number(row.billBalanceAfter),
      });
    }
    return map;
  },

  findByCustomer: (
    customerId: string,
    range: { from?: Date; to?: Date },
  ) =>
    prisma.ledgerEntry.findMany({
      where: {
        customerId,
        entryDate: {
          gte: range.from,
          lte: range.to,
        },
      },
      orderBy: { sequence: "asc" },
    }),

  /** Balances as of just before `before` — used to seed the opening row of a filtered date-range statement. */
  findLastBefore: (customerId: string, before: Date) =>
    prisma.ledgerEntry.findFirst({
      where: { customerId, entryDate: { lt: before } },
      orderBy: { sequence: "desc" },
    }),
};
