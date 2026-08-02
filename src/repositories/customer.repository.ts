import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const customerRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.CustomerCreateInput) =>
    tx.customer.create({ data }),

  findMany: (args: Prisma.CustomerFindManyArgs) =>
    prisma.customer.findMany({ ...args, where: { ...args.where, deletedAt: null } }),

  count: (where: Prisma.CustomerWhereInput) => prisma.customer.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) => prisma.customer.findUnique({ where: { id } }),

  update: (id: string, data: Prisma.CustomerUpdateInput) =>
    prisma.customer.update({ where: { id }, data }),

  /** Soft delete only — customers carry sales/payment/ledger history that must never be lost. */
  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.customer.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  recent: (limit = 5) =>
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: limit }),
};
