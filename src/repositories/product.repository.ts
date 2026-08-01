import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const productRepository = {
  findMany: (args: Prisma.ProductFindManyArgs) => prisma.product.findMany(args),
  count: (where: Prisma.ProductWhereInput) => prisma.product.count({ where }),
  findById: (id: string) => prisma.product.findUnique({ where: { id } }),
  create: (data: Prisma.ProductCreateInput) => prisma.product.create({ data }),
  update: (id: string, data: Prisma.ProductUpdateInput) =>
    prisma.product.update({ where: { id }, data }),
  remove: (id: string) => prisma.product.delete({ where: { id } }),
  recent: (limit = 5) => prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
  distinctCategories: async () => {
    const rows = await prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category).filter((c): c is string => !!c);
  },
};
