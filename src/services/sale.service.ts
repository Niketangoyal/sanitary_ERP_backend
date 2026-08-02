import { Prisma, LedgerAccountType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { saleRepository } from "../repositories/sale.repository";
import { customerRepository } from "../repositories/customer.repository";
import { productRepository } from "../repositories/product.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { ledgerService } from "./ledger.service";
import { settingsService } from "./settings.service";
import { inventoryService, ConsumptionPlanEntry } from "./inventory.service";
import { AppError } from "../utils/AppError";
import { computeLineItem, toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { PAYMENT_MODE_LABELS, ACCOUNT_TYPE_LABELS } from "../utils/labels";
import { CreateSaleInput, UpdateSaleInput } from "../utils/validators/sale.schema";

interface ListSaleQuery extends PaginationQuery {
  search?: string;
  customerId?: string;
  saleType?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
}

/** A Cash (Kacha) sale posts to the customer's Cash account; a Bill (Pakka) sale posts to Bill. */
const accountTypeForSaleType = (saleType: "CASH" | "BILL"): LedgerAccountType =>
  saleType === "CASH" ? "CASH" : "BILL";

interface SaleItemInput {
  productId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  gstPercent?: number;
}

function buildSaleLines(items: SaleItemInput[], productMap: Map<string, { itemName: string; gstPercent: Prisma.Decimal }>) {
  const lineItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    const gstPercent = item.gstPercent ?? Number(product.gstPercent);
    const computed = computeLineItem({
      quantity: item.quantity,
      rate: item.rate,
      discountPercent: item.discountPercent,
      gstPercent,
    });
    return {
      productId: item.productId,
      itemName: product.itemName,
      quantity: toDecimal(item.quantity),
      rate: toDecimal(item.rate),
      discountPercent: toDecimal(item.discountPercent),
      discountAmount: computed.discountAmount,
      gstPercent: toDecimal(gstPercent),
      gstAmount: computed.gstAmount,
      total: computed.total,
    };
  });

  const subtotal = lineItems.reduce((sum, li) => sum.add(li.quantity.mul(li.rate)), toDecimal(0));
  const discountTotal = lineItems.reduce((sum, li) => sum.add(li.discountAmount), toDecimal(0));
  const gstTotal = lineItems.reduce((sum, li) => sum.add(li.gstAmount), toDecimal(0));
  const grandTotal = round2(lineItems.reduce((sum, li) => sum.add(li.total), toDecimal(0)));

  return { lineItems, subtotal: round2(subtotal.sub(discountTotal)), discountTotal: round2(discountTotal), gstTotal: round2(gstTotal), grandTotal };
}

/** Payment amount rules shared by create/update: UNPAID=>0, PAID=>full total, PARTIAL strictly between. */
function resolveAmountPaid(paymentStatus: "PAID" | "UNPAID" | "PARTIAL", amountPaidInput: number, grandTotal: Prisma.Decimal) {
  if (paymentStatus === "PAID") return grandTotal;
  if (paymentStatus === "UNPAID") return toDecimal(0);

  const amountPaid = round2(toDecimal(amountPaidInput));
  if (amountPaid.lte(0) || amountPaid.gte(grandTotal)) {
    throw AppError.badRequest("Partially paid amount must be greater than 0 and less than the invoice total");
  }
  return amountPaid;
}

export const saleService = {
  async list(query: ListSaleQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.SaleWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.saleType ? { saleType: query.saleType as never } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
      ...(query.search ? { invoiceNumber: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      saleRepository.findMany({
        where,
        orderBy: { invoiceDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      saleRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async recent() {
    return saleRepository.recent(5);
  },

  async getById(id: string) {
    const sale = await saleRepository.findById(id);
    if (!sale) throw AppError.notFound("Sale invoice not found");
    return sale;
  },

  async create(input: CreateSaleInput, createdById?: string) {
    const customer = await customerRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound("Customer not found");

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await productRepository.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        throw AppError.badRequest(`Product ${item.productId} not found`);
      }
    }

    const { lineItems, subtotal, discountTotal, gstTotal, grandTotal } = buildSaleLines(input.items, productMap);
    const amountPaid = resolveAmountPaid(input.paymentStatus, input.amountPaid, grandTotal);
    const balanceDue = round2(grandTotal.sub(amountPaid));

    const settings = await settingsService.getOrCreate();
    const accountType = accountTypeForSaleType(input.saleType);

    return prisma.$transaction(async (tx) => {
      // FIFO stock draw-down happens first so a shortfall on any line
      // rolls back the whole invoice instead of partially committing.
      const consumptionPlans: { productId: string; plan: ConsumptionPlanEntry[]; costOfGoods: Prisma.Decimal }[] =
        [];
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        const { totalCost, plan } = await inventoryService.consumeStock(
          tx,
          item.productId,
          item.quantity,
          product.itemName,
        );
        consumptionPlans.push({ productId: item.productId, plan, costOfGoods: totalCost });
      }

      const invoiceNumber = await nextDocumentNumber(
        tx,
        "SALE",
        settings.invoicePrefix,
        input.invoiceDate,
      );

      const sale = await saleRepository.create(tx, {
        invoiceNumber,
        invoiceDate: input.invoiceDate,
        saleType: input.saleType,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentStatus === "UNPAID" ? null : input.paymentMethod,
        amountPaid,
        balanceDue,
        notes: input.notes ?? null,
        subtotal,
        discountTotal,
        gstTotal,
        grandTotal,
        customer: { connect: { id: input.customerId } },
        ...(createdById ? { createdBy: { connect: { id: createdById } } } : {}),
        items: {
          create: lineItems.map((li, index) => ({
            ...li,
            costOfGoods: consumptionPlans[index].costOfGoods,
          })),
        },
      });

      for (let i = 0; i < sale.items.length; i++) {
        await inventoryService.recordConsumption(tx, sale.items[i].id, consumptionPlans[i].plan);
      }

      await ledgerService.postEntry(tx, {
        customerId: input.customerId,
        entryDate: input.invoiceDate,
        type: "SALE",
        accountType,
        description: `Sale Invoice ${invoiceNumber} (${input.saleType === "CASH" ? "Cash/Kacha" : "Bill/Pakka"})`,
        referenceNumber: invoiceNumber,
        debit: sale.grandTotal,
        credit: 0,
        saleId: sale.id,
      });

      if (amountPaid.gt(0) && input.paymentMethod) {
        const paymentNumber = await nextDocumentNumber(
          tx,
          "PAYMENT",
          settings.paymentPrefix,
          input.invoiceDate,
        );

        const payment = await paymentRepository.create(tx, {
          paymentNumber,
          customerId: input.customerId,
          saleId: sale.id,
          date: input.invoiceDate,
          amount: amountPaid,
          mode: input.paymentMethod,
          accountType,
          remarks: `Received at invoicing - ${invoiceNumber}`,
        });

        await ledgerService.postEntry(tx, {
          customerId: input.customerId,
          entryDate: input.invoiceDate,
          type: "PAYMENT",
          accountType,
          description: `Payment Received - ${PAYMENT_MODE_LABELS[input.paymentMethod]} (${ACCOUNT_TYPE_LABELS[accountType]})`,
          referenceNumber: paymentNumber,
          debit: 0,
          credit: amountPaid,
          paymentId: payment.id,
        });
      }

      return sale;
    });
  },

  /**
   * Full reverse-and-repost edit: undoes this invoice's FIFO consumption,
   * its own auto-created up-front payment (if any), and its ledger entries,
   * then re-validates and reposts everything against the new values. The
   * invoice number is kept — this is a correction to the same document, not
   * a new one. Blocked entirely if any Return exists against this sale:
   * a return's eligible-quantity math is locked to the sale's original
   * items, and there's no safe way to unwind that after the fact.
   */
  async update(id: string, input: UpdateSaleInput, updatedById?: string) {
    const existing = await saleRepository.findById(id);
    if (!existing) throw AppError.notFound("Sale invoice not found");
    if (existing.deletedAt) throw AppError.badRequest("This invoice has been deleted");

    const returnCount = await prisma.return.count({ where: { saleId: id, deletedAt: null } });
    if (returnCount > 0) {
      throw AppError.conflict(
        "This invoice has returns recorded against it and cannot be edited. Delete the return(s) first if the invoice truly needs correcting.",
      );
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await productRepository.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of input.items) {
      if (!productMap.has(item.productId)) throw AppError.badRequest(`Product ${item.productId} not found`);
    }

    const { lineItems, subtotal, discountTotal, gstTotal, grandTotal } = buildSaleLines(input.items, productMap);
    const amountPaid = resolveAmountPaid(input.paymentStatus, input.amountPaid, grandTotal);
    const balanceDue = round2(grandTotal.sub(amountPaid));

    const settings = await settingsService.getOrCreate();
    const accountType = accountTypeForSaleType(input.saleType);

    return prisma.$transaction(async (tx) => {
      // Reverse the old up-front payment (if any) — fully re-derived below, not edited in place.
      const oldPayment = await tx.payment.findFirst({ where: { saleId: id, deletedAt: null } });
      if (oldPayment) {
        await ledgerService.reverseEntriesFor(tx, { paymentId: oldPayment.id });
        await tx.payment.delete({ where: { id: oldPayment.id } });
      }

      await ledgerService.reverseEntriesFor(tx, { saleId: id });
      await inventoryService.reverseConsumptionForSale(tx, id);
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      const consumptionPlans: { productId: string; plan: ConsumptionPlanEntry[]; costOfGoods: Prisma.Decimal }[] =
        [];
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        const { totalCost, plan } = await inventoryService.consumeStock(tx, item.productId, item.quantity, product.itemName);
        consumptionPlans.push({ productId: item.productId, plan, costOfGoods: totalCost });
      }

      const updated = await saleRepository.update(tx, id, {
        invoiceDate: input.invoiceDate,
        saleType: input.saleType,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentStatus === "UNPAID" ? null : input.paymentMethod,
        amountPaid,
        balanceDue,
        notes: input.notes ?? null,
        subtotal,
        discountTotal,
        gstTotal,
        grandTotal,
        ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
        items: {
          create: lineItems.map((li, index) => ({ ...li, costOfGoods: consumptionPlans[index].costOfGoods })),
        },
      });

      for (const item of updated.items) {
        const plan = consumptionPlans.find((p) => p.productId === item.productId);
        if (plan) await inventoryService.recordConsumption(tx, item.id, plan.plan);
      }

      await ledgerService.postEntry(tx, {
        customerId: existing.customerId,
        entryDate: input.invoiceDate,
        type: "SALE",
        accountType,
        description: `Sale Invoice ${existing.invoiceNumber} (${input.saleType === "CASH" ? "Cash/Kacha" : "Bill/Pakka"})`,
        referenceNumber: existing.invoiceNumber,
        debit: grandTotal,
        credit: 0,
        saleId: id,
      });

      if (amountPaid.gt(0) && input.paymentMethod) {
        const paymentNumber = await nextDocumentNumber(tx, "PAYMENT", settings.paymentPrefix, input.invoiceDate);

        const payment = await paymentRepository.create(tx, {
          paymentNumber,
          customerId: existing.customerId,
          saleId: id,
          date: input.invoiceDate,
          amount: amountPaid,
          mode: input.paymentMethod,
          accountType,
          remarks: `Received at invoicing - ${existing.invoiceNumber}`,
        });

        await ledgerService.postEntry(tx, {
          customerId: existing.customerId,
          entryDate: input.invoiceDate,
          type: "PAYMENT",
          accountType,
          description: `Payment Received - ${PAYMENT_MODE_LABELS[input.paymentMethod]} (${ACCOUNT_TYPE_LABELS[accountType]})`,
          referenceNumber: paymentNumber,
          debit: 0,
          credit: amountPaid,
          paymentId: payment.id,
        });
      }

      return updated;
    });
  },

  /**
   * Soft delete: reverses FIFO consumption, the linked up-front payment (if
   * any), and ledger entries. Blocked entirely if any Return exists against
   * this sale — same reasoning as update.
   */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await saleRepository.findById(id);
    if (!existing) throw AppError.notFound("Sale invoice not found");
    if (existing.deletedAt) throw AppError.badRequest("This invoice has already been deleted");

    const returnCount = await prisma.return.count({ where: { saleId: id, deletedAt: null } });
    if (returnCount > 0) {
      throw AppError.conflict(
        "This invoice has returns recorded against it and cannot be deleted. Delete the return(s) first.",
      );
    }

    return prisma.$transaction(async (tx) => {
      const oldPayment = await tx.payment.findFirst({ where: { saleId: id, deletedAt: null } });
      if (oldPayment) {
        await ledgerService.reverseEntriesFor(tx, { paymentId: oldPayment.id });
        await tx.payment.delete({ where: { id: oldPayment.id } });
      }

      await ledgerService.reverseEntriesFor(tx, { saleId: id });
      await inventoryService.reverseConsumptionForSale(tx, id);

      return saleRepository.softDelete(tx, id, deletedById, reason);
    });
  },
};
