import { Prisma, LedgerAccountType, PaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { returnRepository } from "../repositories/return.repository";
import { customerRepository } from "../repositories/customer.repository";
import { productRepository } from "../repositories/product.repository";
import { saleRepository } from "../repositories/sale.repository";
import { ledgerService } from "./ledger.service";
import { settingsService } from "./settings.service";
import { inventoryService } from "./inventory.service";
import { AppError } from "../utils/AppError";
import { computeLineItem, toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateReturnInput, UpdateReturnInput } from "../utils/validators/return.schema";

interface ListReturnQuery extends PaginationQuery {
  search?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

const accountTypeForSaleType = (saleType: "CASH" | "BILL"): LedgerAccountType =>
  saleType === "CASH" ? "CASH" : "BILL";

interface ReturnItemInput {
  productId: string;
  quantity: number;
  rate: number;
  gstPercent?: number;
}

/**
 * Validates return items against what the sale actually sold (product must
 * be on the invoice, quantity capped at sold-minus-already-returned) and
 * builds the priced line items. Shared by create and update — `excludeReturnId`
 * lets an edit re-validate without counting the return's own prior quantities
 * against itself.
 */
async function validateAndBuildLines(
  originalSale: NonNullable<Awaited<ReturnType<typeof saleRepository.findById>>>,
  items: ReturnItemInput[],
  excludeReturnId?: string,
) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await productRepository.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const soldByProduct = new Map<string, Prisma.Decimal>();
  for (const item of originalSale.items) {
    soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? toDecimal(0)).add(item.quantity));
  }
  const returnedByProduct = await returnRepository.sumReturnedQuantityByProduct(
    prisma,
    originalSale.id,
    excludeReturnId,
  );

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) throw AppError.badRequest(`Product ${item.productId} not found`);

    const sold = soldByProduct.get(item.productId);
    if (!sold) {
      throw AppError.badRequest(`"${product.itemName}" was not sold on invoice ${originalSale.invoiceNumber}`);
    }

    const alreadyReturned = toDecimal(returnedByProduct.get(item.productId) ?? 0);
    const eligible = sold.sub(alreadyReturned);
    if (toDecimal(item.quantity).gt(eligible)) {
      throw AppError.badRequest(
        `Cannot return ${item.quantity} of "${product.itemName}" — only ${eligible} remaining eligible (${sold} sold, ${alreadyReturned} already returned)`,
      );
    }
  }

  // Restock cost basis: reuse what was actually paid on the matching line of
  // the original invoice (its FIFO average cost) so profit reports stay
  // accurate; fall back to the product's reference cost otherwise.
  const originalUnitCost = new Map<string, Prisma.Decimal>();
  for (const saleItem of originalSale.items) {
    if (toDecimal(saleItem.quantity).gt(0)) {
      originalUnitCost.set(saleItem.productId, toDecimal(saleItem.costOfGoods).div(saleItem.quantity));
    }
  }

  const lineItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const gstPercent = item.gstPercent ?? Number(product.gstPercent);
    const computed = computeLineItem({ quantity: item.quantity, rate: item.rate, gstPercent });
    return {
      productId: item.productId,
      itemName: product.itemName,
      quantity: toDecimal(item.quantity),
      rate: toDecimal(item.rate),
      gstPercent: toDecimal(gstPercent),
      gstAmount: computed.gstAmount,
      total: computed.total,
    };
  });

  const subtotal = round2(lineItems.reduce((sum, li) => sum.add(li.quantity.mul(li.rate)), toDecimal(0)));
  const gstTotal = round2(lineItems.reduce((sum, li) => sum.add(li.gstAmount), toDecimal(0)));
  const grandTotal = round2(lineItems.reduce((sum, li) => sum.add(li.total), toDecimal(0)));

  return { productMap, originalUnitCost, lineItems, subtotal, gstTotal, grandTotal };
}

/**
 * Single source of truth for a sale's balanceDue/paymentStatus, recomputed
 * from scratch (grandTotal - amountPaid - non-deleted returns) rather than
 * incrementally — so editing/deleting a return can never drift the sale's
 * balance no matter how many other returns exist against it.
 */
async function recomputeSaleBalance(tx: Prisma.TransactionClient, saleId: string) {
  const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
  const returned = await tx.return.aggregate({
    where: { saleId, deletedAt: null },
    _sum: { grandTotal: true },
  });
  const totalReturned = toDecimal(returned._sum.grandTotal ?? 0);
  const newBalanceDue = toDecimal(sale.grandTotal).sub(sale.amountPaid).sub(totalReturned);
  const clampedBalanceDue = newBalanceDue.lt(0) ? toDecimal(0) : round2(newBalanceDue);
  const newStatus: PaymentStatus = clampedBalanceDue.lte(0)
    ? "PAID"
    : toDecimal(sale.amountPaid).gt(0)
      ? "PARTIAL"
      : "UNPAID";

  await tx.sale.update({
    where: { id: saleId },
    data: { balanceDue: clampedBalanceDue, paymentStatus: newStatus },
  });
}

export const returnService = {
  async list(query: ListReturnQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.ReturnWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search ? { returnNumber: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.from || query.to
        ? {
            returnDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      returnRepository.findMany({
        where,
        orderBy: { returnDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      returnRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async recent() {
    return returnRepository.recent(5);
  },

  async getById(id: string) {
    const ret = await returnRepository.findById(id);
    if (!ret) throw AppError.notFound("Return not found");
    return ret;
  },

  /**
   * Products on a sale that are still eligible to be returned, with
   * quantity already returned against each subtracted off — this is what
   * the Return form's item picker is constrained to.
   */
  async getEligibleItems(saleId: string, excludeReturnId?: string) {
    const sale = await saleRepository.findById(saleId);
    if (!sale) throw AppError.notFound("Invoice not found");

    const soldByProduct = new Map<string, Prisma.Decimal>();
    for (const item of sale.items) {
      soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? toDecimal(0)).add(item.quantity));
    }

    const returnedByProduct = await returnRepository.sumReturnedQuantityByProduct(prisma, saleId, excludeReturnId);

    return sale.items
      .filter((item, index) => sale.items.findIndex((i) => i.productId === item.productId) === index)
      .map((item) => {
        const sold = soldByProduct.get(item.productId) ?? toDecimal(0);
        const returned = toDecimal(returnedByProduct.get(item.productId) ?? 0);
        const eligible = round2(sold.sub(returned));
        return {
          productId: item.productId,
          itemName: item.itemName,
          rate: Number(item.rate),
          gstPercent: Number(item.gstPercent),
          quantitySold: sold.toNumber(),
          quantityReturned: returned.toNumber(),
          quantityEligible: eligible.lt(0) ? 0 : eligible.toNumber(),
        };
      });
  },

  async create(input: CreateReturnInput, processedById?: string) {
    const customer = await customerRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound("Customer not found");

    const originalSale = await saleRepository.findById(input.saleId);
    if (!originalSale) throw AppError.notFound("Original invoice not found");
    if (originalSale.customerId !== input.customerId) {
      throw AppError.badRequest("The original invoice does not belong to the selected customer");
    }

    const { productMap, originalUnitCost, lineItems, subtotal, gstTotal, grandTotal } =
      await validateAndBuildLines(originalSale, input.items);

    const settings = await settingsService.getOrCreate();
    const accountType = accountTypeForSaleType(originalSale.saleType);

    return prisma.$transaction(async (tx) => {
      const returnNumber = await nextDocumentNumber(tx, "RETURN", settings.returnPrefix, input.returnDate);

      const returnDoc = await returnRepository.create(tx, {
        returnNumber,
        returnDate: input.returnDate,
        reason: input.reason ?? null,
        subtotal,
        gstTotal,
        grandTotal,
        customer: { connect: { id: input.customerId } },
        sale: { connect: { id: input.saleId } },
        ...(processedById ? { processedBy: { connect: { id: processedById } } } : {}),
        items: { create: lineItems },
      });

      for (const item of lineItems) {
        const product = productMap.get(item.productId)!;
        const unitCost = originalUnitCost.get(item.productId) ?? toDecimal(product.purchasePrice);
        await inventoryService.restockFromReturn(tx, {
          productId: item.productId,
          quantity: item.quantity,
          unitCost,
          returnDate: input.returnDate,
          returnId: returnDoc.id,
        });
      }

      await ledgerService.postEntry(tx, {
        customerId: input.customerId,
        entryDate: input.returnDate,
        type: "RETURN",
        accountType,
        description: `Sales Return ${returnNumber}`,
        referenceNumber: returnNumber,
        debit: 0,
        credit: returnDoc.grandTotal,
        returnId: returnDoc.id,
      });

      await recomputeSaleBalance(tx, originalSale.id);

      return returnDoc;
    }, { timeout: 30000 });
  },

  /**
   * Full reverse-and-repost edit: undoes this return's inventory + ledger
   * effect, re-validates the new items against the (unchanged) original
   * sale, then reposts fresh inventory/ledger effects and recomputes the
   * sale's balance. Blocked by inventoryService if any of the stock this
   * return restocked has already been resold — that cost is locked into a
   * later invoice and can't be safely unwound.
   */
  async update(id: string, input: UpdateReturnInput, updatedById?: string) {
    const existing = await returnRepository.findById(id);
    if (!existing) throw AppError.notFound("Return not found");
    if (existing.deletedAt) throw AppError.badRequest("This return has been deleted");
    if (!existing.saleId) throw AppError.badRequest("This return has no linked invoice and cannot be edited");

    const originalSale = await saleRepository.findById(existing.saleId);
    if (!originalSale) throw AppError.notFound("Original invoice not found");

    const { productMap, originalUnitCost, lineItems, subtotal, gstTotal, grandTotal } =
      await validateAndBuildLines(originalSale, input.items, id);

    const accountType = accountTypeForSaleType(originalSale.saleType);

    return prisma.$transaction(async (tx) => {
      await inventoryService.reverseRestockFromReturn(tx, id);
      await ledgerService.reverseEntriesFor(tx, { returnId: id });
      await tx.returnItem.deleteMany({ where: { returnId: id } });

      const updated = await returnRepository.update(tx, id, {
        returnDate: input.returnDate,
        reason: input.reason ?? null,
        subtotal,
        gstTotal,
        grandTotal,
        ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
        items: { create: lineItems },
      });

      for (const item of lineItems) {
        const product = productMap.get(item.productId)!;
        const unitCost = originalUnitCost.get(item.productId) ?? toDecimal(product.purchasePrice);
        await inventoryService.restockFromReturn(tx, {
          productId: item.productId,
          quantity: item.quantity,
          unitCost,
          returnDate: input.returnDate,
          returnId: id,
        });
      }

      await ledgerService.postEntry(tx, {
        customerId: existing.customerId,
        entryDate: input.returnDate,
        type: "RETURN",
        accountType,
        description: `Sales Return ${existing.returnNumber}`,
        referenceNumber: existing.returnNumber,
        debit: 0,
        credit: grandTotal,
        returnId: id,
      });

      await recomputeSaleBalance(tx, originalSale.id);

      return updated;
    }, { timeout: 30000 });
  },

  /** Soft delete: reverses inventory + ledger effects, then marks the row deleted (kept for audit). */
  async delete(id: string, deletedById: string, reason?: string) {
    const existing = await returnRepository.findById(id);
    if (!existing) throw AppError.notFound("Return not found");
    if (existing.deletedAt) throw AppError.badRequest("This return has already been deleted");

    return prisma.$transaction(async (tx) => {
      await inventoryService.reverseRestockFromReturn(tx, id);
      await ledgerService.reverseEntriesFor(tx, { returnId: id });
      const deleted = await returnRepository.softDelete(tx, id, deletedById, reason);
      if (existing.saleId) await recomputeSaleBalance(tx, existing.saleId);
      return deleted;
    }, { timeout: 30000 });
  },
};
