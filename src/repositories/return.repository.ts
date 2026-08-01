import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const returnWithRelations = {
  customer: true,
  sale: true,
  items: { include: { product: true } },
} satisfies Prisma.ReturnInclude;

export const returnRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.ReturnCreateInput) =>
    tx.return.create({ data, include: returnWithRelations }),

  findMany: (args: Prisma.ReturnFindManyArgs) =>
    prisma.return.findMany({ ...args, include: { customer: true, sale: true } }),

  count: (where: Prisma.ReturnWhereInput) => prisma.return.count({ where }),

  findById: (id: string) => prisma.return.findUnique({ where: { id }, include: returnWithRelations }),

  recent: (limit = 5) =>
    prisma.return.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: true },
    }),

  sumGrandTotalInRange: async (from: Date, to: Date) => {
    const result = await prisma.return.aggregate({
      where: { returnDate: { gte: from, lte: to } },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  },
};
