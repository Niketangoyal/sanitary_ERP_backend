import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const advanceRepository = {
  findByEmployee: (employeeId: string) =>
    prisma.advancePayment.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { date: "desc" },
    }),

  findById: (id: string) => prisma.advancePayment.findUnique({ where: { id } }),

  update: (id: string, data: Prisma.AdvancePaymentUpdateInput) =>
    prisma.advancePayment.update({ where: { id }, data }),

  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.advancePayment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  /** Oldest-first advances still owing something — the order adjustments are applied against. */
  findOutstandingOrdered: (tx: Prisma.TransactionClient, employeeId: string) =>
    tx.advancePayment.findMany({
      where: { employeeId, status: { in: ["PENDING", "PARTIALLY_ADJUSTED"] }, deletedAt: null },
      orderBy: { date: "asc" },
    }),

  create: (tx: Prisma.TransactionClient, data: Prisma.AdvancePaymentUncheckedCreateInput) =>
    tx.advancePayment.create({ data }),

  applyAdjustment: (
    tx: Prisma.TransactionClient,
    id: string,
    adjustedAmount: Prisma.Decimal.Value,
    status: "PENDING" | "PARTIALLY_ADJUSTED" | "FULLY_ADJUSTED",
  ) => tx.advancePayment.update({ where: { id }, data: { adjustedAmount, status } }),

  createAdjustmentRecord: (tx: Prisma.TransactionClient, data: Prisma.AdvanceAdjustmentUncheckedCreateInput) =>
    tx.advanceAdjustment.create({ data }),

  /** All employees with a nonzero outstanding advance balance, for the Pending Advance / Remaining Summary report. */
  pendingByEmployee: async () => {
    const rows = await prisma.advancePayment.findMany({
      where: { status: { in: ["PENDING", "PARTIALLY_ADJUSTED"] }, deletedAt: null },
      include: { employee: true },
    });

    const map = new Map<
      string,
      { employeeId: string; employeeCode: string; fullName: string; totalPending: number; count: number }
    >();

    for (const advance of rows) {
      const remaining = Number(advance.amount) - Number(advance.adjustedAmount);
      if (remaining <= 0) continue;
      const existing = map.get(advance.employeeId);
      if (existing) {
        existing.totalPending += remaining;
        existing.count += 1;
      } else {
        map.set(advance.employeeId, {
          employeeId: advance.employeeId,
          employeeCode: advance.employee.employeeCode,
          fullName: advance.employee.fullName,
          totalPending: remaining,
          count: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  },

  findAdjustments: (args: Prisma.AdvanceAdjustmentFindManyArgs) =>
    prisma.advanceAdjustment.findMany({
      ...args,
      include: {
        employee: true,
        advance: true,
        salaryRecord: true,
        processedBy: { select: { id: true, name: true } },
      },
    }),
};
