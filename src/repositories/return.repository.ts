import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const returnWithRelations = {
  customer: true,
  sale: true,
  processedBy: { select: { id: true, name: true } },
  items: { include: { product: true } },
} satisfies Prisma.ReturnInclude;

export const returnRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.ReturnCreateInput) =>
    tx.return.create({ data, include: returnWithRelations }),

  update: (tx: Prisma.TransactionClient, id: string, data: Prisma.ReturnUpdateInput) =>
    tx.return.update({ where: { id }, data, include: returnWithRelations }),

  softDelete: (tx: Prisma.TransactionClient, id: string, deletedById: string, deletionReason?: string | null) =>
    tx.return.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  findMany: (args: Prisma.ReturnFindManyArgs) =>
    prisma.return.findMany({
      ...args,
      where: { ...args.where, deletedAt: null },
      include: { customer: true, sale: true, processedBy: { select: { id: true, name: true } } },
    }),

  count: (where: Prisma.ReturnWhereInput) => prisma.return.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) =>
    prisma.return.findUnique({ where: { id }, include: returnWithRelations }),

  recent: (limit = 5) =>
    prisma.return.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: true },
    }),

  sumGrandTotalInRange: async (from: Date, to: Date) => {
    const result = await prisma.return.aggregate({
      where: { returnDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  },

  /**
   * Quantity already returned per product against a specific sale — the
   * basis for the "remaining eligible" cap. `excludeReturnId` leaves a
   * return's own prior quantities out of the sum when re-validating it
   * during an edit (otherwise it would count against its own new values).
   */
  sumReturnedQuantityByProduct: async (
    tx: Prisma.TransactionClient | typeof prisma,
    saleId: string,
    excludeReturnId?: string,
  ): Promise<Map<string, Prisma.Decimal>> => {
    const grouped = await tx.returnItem.groupBy({
      by: ["productId"],
      where: {
        return: {
          saleId,
          deletedAt: null,
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      _sum: { quantity: true },
    });
    return new Map(grouped.map((g) => [g.productId, g._sum.quantity ?? new Prisma.Decimal(0)]));
  },
};
