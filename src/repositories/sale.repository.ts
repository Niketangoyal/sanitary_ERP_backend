import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const saleWithRelations = {
  customer: true,
  items: { include: { product: true } },
  payments: { orderBy: { date: "asc" } },
} satisfies Prisma.SaleInclude;

export const saleRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.SaleCreateInput) =>
    tx.sale.create({ data, include: saleWithRelations }),

  update: (tx: Prisma.TransactionClient, id: string, data: Prisma.SaleUpdateInput) =>
    tx.sale.update({ where: { id }, data, include: saleWithRelations }),

  softDelete: (tx: Prisma.TransactionClient, id: string, deletedById: string, deletionReason?: string | null) =>
    tx.sale.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  findMany: (args: Prisma.SaleFindManyArgs) =>
    prisma.sale.findMany({ ...args, where: { ...args.where, deletedAt: null }, include: { customer: true } }),

  count: (where: Prisma.SaleWhereInput) => prisma.sale.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) =>
    prisma.sale.findUnique({ where: { id }, include: saleWithRelations }),

  recent: (limit = 5) =>
    prisma.sale.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: true },
    }),

  sumGrandTotalInRange: async (from: Date, to: Date) => {
    const result = await prisma.sale.aggregate({
      where: { invoiceDate: { gte: from, lte: to }, deletedAt: null },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  },
};
