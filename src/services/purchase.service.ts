import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { purchaseRepository } from "../repositories/purchase.repository";
import { productRepository } from "../repositories/product.repository";
import { supplierRepository } from "../repositories/supplier.repository";
import { AppError } from "../utils/AppError";
import { toDecimal } from "../utils/money";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreatePurchaseInput, UpdatePurchaseInput } from "../utils/validators/purchase.schema";

interface ListPurchaseQuery extends PaginationQuery {
  productId?: string;
  from?: string;
  to?: string;
}

export const purchaseService = {
  async list(query: ListPurchaseQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.StockBatchWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.from || query.to
        ? {
            purchaseDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      purchaseRepository.findMany({
        where,
        orderBy: { purchaseDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      purchaseRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  /** Current stock on hand per product, derived from remaining batch quantities. */
  async stockLevels() {
    return purchaseRepository.stockOnHandByProduct();
  },

  async getById(id: string) {
    const batch = await purchaseRepository.findById(id);
    if (!batch) throw AppError.notFound("Purchase not found");
    return batch;
  },

  async create(input: CreatePurchaseInput, createdById?: string) {
    const product = await productRepository.findById(input.productId);
    if (!product) throw AppError.notFound("Product not found");

    let supplierName = input.supplier ?? null;
    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId);
      if (!supplier) throw AppError.notFound("Supplier not found");
      supplierName = supplier.name;
    }

    return prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.create({
        data: {
          productId: input.productId,
          purchasePrice: input.purchasePrice,
          quantity: input.quantity,
          quantityRemaining: input.quantity,
          purchaseDate: input.purchaseDate,
          supplier: supplierName,
          supplierId: input.supplierId ?? null,
          ...(createdById ? { createdById } : {}),
        },
        include: { product: true, supplierRef: true },
      });

      // Keep the product's reference cost pointed at the latest purchase
      // price so the next purchase form/sale form prefill something sane —
      // this never affects FIFO costing, which always reads the batches.
      await tx.product.update({
        where: { id: input.productId },
        data: { purchasePrice: input.purchasePrice },
      });

      return batch;
    });
  },

  /**
   * Price/quantity can only be edited while the batch is still fully
   * untouched (quantityRemaining === quantity) — once any of it has sold,
   * that cost is locked into a historical invoice's COGS and can't be
   * safely changed. Supplier and purchase date can always be corrected.
   */
  async update(id: string, input: UpdatePurchaseInput, updatedById?: string) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) throw AppError.notFound("Purchase not found");
    if (existing.deletedAt) throw AppError.badRequest("This purchase has been deleted");

    const untouched = toDecimal(existing.quantityRemaining).equals(toDecimal(existing.quantity));
    const changingFinancials =
      input.purchasePrice !== undefined || input.quantity !== undefined;

    if (changingFinancials && !untouched) {
      throw AppError.badRequest(
        "Some of this batch's stock has already been sold — its price and quantity are locked into historical invoices and can't be edited. You may still correct the supplier or purchase date.",
      );
    }

    let supplierName = input.supplier;
    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId);
      if (!supplier) throw AppError.notFound("Supplier not found");
      supplierName = supplier.name;
    }

    const newQuantity = input.quantity !== undefined ? toDecimal(input.quantity) : undefined;

    return purchaseRepository.update(id, {
      ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice } : {}),
      ...(newQuantity !== undefined ? { quantity: newQuantity, quantityRemaining: newQuantity } : {}),
      ...(input.purchaseDate !== undefined ? { purchaseDate: input.purchaseDate } : {}),
      ...(input.supplierId !== undefined ? { supplierRef: input.supplierId ? { connect: { id: input.supplierId } } : { disconnect: true } } : {}),
      ...(supplierName !== undefined ? { supplier: supplierName } : {}),
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /** Blocked outright (no override) if any of the batch's stock has already been sold. */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await purchaseRepository.findById(id);
    if (!existing) throw AppError.notFound("Purchase not found");
    if (existing.deletedAt) throw AppError.badRequest("This purchase has already been deleted");

    if (!toDecimal(existing.quantityRemaining).equals(toDecimal(existing.quantity))) {
      throw AppError.conflict(
        "Some of this batch's stock has already been sold and cannot be deleted. This would corrupt historical cost records.",
      );
    }

    await purchaseRepository.softDelete(id, deletedById, reason);
  },
};
