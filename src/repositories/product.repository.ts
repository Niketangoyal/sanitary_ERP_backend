import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const productRepository = {
  findMany: (args: Prisma.ProductFindManyArgs) =>
    prisma.product.findMany({ ...args, where: { ...args.where, deletedAt: null } }),
  count: (where: Prisma.ProductWhereInput) => prisma.product.count({ where: { ...where, deletedAt: null } }),
  findById: (id: string) => prisma.product.findUnique({ where: { id } }),
  create: (data: Prisma.ProductCreateInput) => prisma.product.create({ data }),
  update: (id: string, data: Prisma.ProductUpdateInput) =>
    prisma.product.update({ where: { id }, data }),
  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.product.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),
  hasTransactions: async (id: string) => {
    const [batches, saleItems, returnItems] = await Promise.all([
      prisma.stockBatch.count({ where: { productId: id, deletedAt: null } }),
      prisma.saleItem.count({ where: { productId: id } }),
      prisma.returnItem.count({ where: { productId: id } }),
    ]);
    return batches > 0 || saleItems > 0 || returnItems > 0;
  },
  recent: (limit = 5) =>
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: limit }),
  distinctCategories: async () => {
    const rows = await prisma.product.findMany({
      where: { category: { not: null }, deletedAt: null },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category).filter((c): c is string => !!c);
  },
};
