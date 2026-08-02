import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const withRelations = {
  product: true,
  supplierRef: true,
} satisfies Prisma.StockBatchInclude;

export const purchaseRepository = {
  create: (data: Prisma.StockBatchUncheckedCreateInput) =>
    prisma.stockBatch.create({ data, include: withRelations }),

  findMany: (args: Prisma.StockBatchFindManyArgs) =>
    prisma.stockBatch.findMany({ ...args, where: { ...args.where, deletedAt: null }, include: withRelations }),

  count: (where: Prisma.StockBatchWhereInput) => prisma.stockBatch.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) => prisma.stockBatch.findUnique({ where: { id }, include: withRelations }),

  update: (id: string, data: Prisma.StockBatchUpdateInput) =>
    prisma.stockBatch.update({ where: { id }, data, include: withRelations }),

  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.stockBatch.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  stockOnHandByProduct: async () => {
    const rows = await prisma.stockBatch.groupBy({
      by: ["productId"],
      where: { deletedAt: null },
      _sum: { quantityRemaining: true },
    });
    return new Map(rows.map((r) => [r.productId, Number(r._sum.quantityRemaining ?? 0)]));
  },
};
