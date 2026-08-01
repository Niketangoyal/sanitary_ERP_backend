import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const customerRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.CustomerCreateInput) =>
    tx.customer.create({ data }),

  findMany: (args: Prisma.CustomerFindManyArgs) => prisma.customer.findMany(args),

  count: (where: Prisma.CustomerWhereInput) => prisma.customer.count({ where }),

  findById: (id: string) => prisma.customer.findUnique({ where: { id } }),

  update: (id: string, data: Prisma.CustomerUpdateInput) =>
    prisma.customer.update({ where: { id }, data }),

  remove: (id: string) => prisma.customer.delete({ where: { id } }),

  recent: (limit = 5) =>
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
};
