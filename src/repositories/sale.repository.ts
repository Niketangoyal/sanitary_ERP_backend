import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const saleWithRelations = {
  customer: true,
  items: { include: { product: true } },
} satisfies Prisma.SaleInclude;

export const saleRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.SaleCreateInput) =>
    tx.sale.create({ data, include: saleWithRelations }),

  findMany: (args: Prisma.SaleFindManyArgs) =>
    prisma.sale.findMany({ ...args, include: { customer: true } }),

  count: (where: Prisma.SaleWhereInput) => prisma.sale.count({ where }),

  findById: (id: string) =>
    prisma.sale.findUnique({ where: { id }, include: saleWithRelations }),

  recent: (limit = 5) =>
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: true },
    }),

  sumGrandTotalInRange: async (from: Date, to: Date) => {
    const result = await prisma.sale.aggregate({
      where: { invoiceDate: { gte: from, lte: to } },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  },
};
