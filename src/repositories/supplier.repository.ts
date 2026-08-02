import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const supplierRepository = {
  create: (data: Prisma.SupplierCreateInput) => prisma.supplier.create({ data }),

  findMany: (args: Prisma.SupplierFindManyArgs) =>
    prisma.supplier.findMany({ ...args, where: { ...args.where, deletedAt: null } }),

  count: (where: Prisma.SupplierWhereInput) => prisma.supplier.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) => prisma.supplier.findUnique({ where: { id } }),

  update: (id: string, data: Prisma.SupplierUpdateInput) => prisma.supplier.update({ where: { id }, data }),

  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.supplier.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  hasPurchases: async (id: string) => {
    const count = await prisma.stockBatch.count({ where: { supplierId: id, deletedAt: null } });
    return count > 0;
  },
};
