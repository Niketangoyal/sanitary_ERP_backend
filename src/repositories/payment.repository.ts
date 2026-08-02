import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const paymentRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.PaymentUncheckedCreateInput) =>
    tx.payment.create({ data, include: { customer: true } }),

  update: (tx: Prisma.TransactionClient, id: string, data: Prisma.PaymentUpdateInput) =>
    tx.payment.update({ where: { id }, data, include: { customer: true } }),

  softDelete: (tx: Prisma.TransactionClient, id: string, deletedById: string, deletionReason?: string | null) =>
    tx.payment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  findMany: (args: Prisma.PaymentFindManyArgs) =>
    prisma.payment.findMany({ ...args, where: { ...args.where, deletedAt: null }, include: { customer: true } }),

  count: (where: Prisma.PaymentWhereInput) => prisma.payment.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) => prisma.payment.findUnique({ where: { id }, include: { customer: true } }),

  recent: (limit = 5) =>
    prisma.payment.findMany({
      where: { deletedAt: null },
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
