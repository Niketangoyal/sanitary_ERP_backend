import { Prisma } from "@prisma/client";
import { productRepository } from "../repositories/product.repository";
import { AppError } from "../utils/AppError";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateProductInput, UpdateProductInput } from "../utils/validators/product.schema";

interface ListProductQuery extends PaginationQuery {
  search?: string;
  category?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export const productService = {
  async list(query: ListProductQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { itemName: { contains: query.search, mode: "insensitive" } },
              { brand: { contains: query.search, mode: "insensitive" } },
              { specification: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      productRepository.findMany({
        where,
        orderBy: { itemName: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      productRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async recent() {
    return productRepository.recent(5);
  },

  async categories() {
    return productRepository.distinctCategories();
  },

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw AppError.notFound("Product not found");
    return product;
  },

  async create(input: CreateProductInput, createdById?: string) {
    return productRepository.create({
      itemName: input.itemName,
      brand: input.brand ?? null,
      category: input.category ?? null,
      specification: input.specification ?? null,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      gstPercent: input.gstPercent,
      status: input.status,
      ...(createdById ? { createdBy: { connect: { id: createdById } } } : {}),
    });
  },

  async update(id: string, input: UpdateProductInput, updatedById?: string) {
    const existing = await productRepository.findById(id);
    if (!existing) throw AppError.notFound("Product not found");
    return productRepository.update(id, {
      ...input,
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /** Soft delete only — blocked outright (no override) if the product has any purchase/sale/return history. */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await productRepository.findById(id);
    if (!existing) throw AppError.notFound("Product not found");
    if (existing.deletedAt) throw AppError.badRequest("This product has already been deleted");

    if (await productRepository.hasTransactions(id)) {
      throw AppError.conflict(
        "This product has purchase, sale, or return history and cannot be deleted. Mark it inactive instead.",
      );
    }

    await productRepository.softDelete(id, deletedById, reason);
  },
};
