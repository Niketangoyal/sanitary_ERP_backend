import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const paymentRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.PaymentUncheckedCreateInput) =>
    tx.payment.create({ data, include: { customer: true } }),

  findMany: (args: Prisma.PaymentFindManyArgs) =>
    prisma.payment.findMany({ ...args, include: { customer: true } }),

  count: (where: Prisma.PaymentWhereInput) => prisma.payment.count({ where }),

  findById: (id: string) => prisma.payment.findUnique({ where: { id }, include: { customer: true } }),

  recent: (limit = 5) =>
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: true },
    }),

  sumAmountInRange: async (from: Date, to: Date) => {
    const result = await prisma.payment.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },
};
