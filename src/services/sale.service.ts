import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { saleRepository } from "../repositories/sale.repository";
import { customerRepository } from "../repositories/customer.repository";
import { productRepository } from "../repositories/product.repository";
import { ledgerService } from "./ledger.service";
import { settingsService } from "./settings.service";
import { AppError } from "../utils/AppError";
import { computeLineItem, toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateSaleInput } from "../utils/validators/sale.schema";

interface ListSaleQuery extends PaginationQuery {
  search?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

export const saleService = {
  async list(query: ListSaleQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.SaleWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
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

    const lineItems = input.items.map((item) => {
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
    const grandTotal = lineItems.reduce((sum, li) => sum.add(li.total), toDecimal(0));

    const settings = await settingsService.getOrCreate();

    return prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(
        tx,
        "SALE",
        settings.invoicePrefix,
        input.invoiceDate,
      );

      const sale = await saleRepository.create(tx, {
        invoiceNumber,
        invoiceDate: input.invoiceDate,
        notes: input.notes ?? null,
        subtotal: round2(subtotal.sub(discountTotal)),
        discountTotal: round2(discountTotal),
        gstTotal: round2(gstTotal),
        grandTotal: round2(grandTotal),
        customer: { connect: { id: input.customerId } },
        ...(createdById ? { createdBy: { connect: { id: createdById } } } : {}),
        items: { create: lineItems },
      });

      await ledgerService.postEntry(tx, {
        customerId: input.customerId,
        entryDate: input.invoiceDate,
        type: "SALE",
        accountType: "BILL",
        description: `Sale Invoice ${invoiceNumber}`,
        referenceNumber: invoiceNumber,
        debit: sale.grandTotal,
        credit: 0,
        saleId: sale.id,
      });

      return sale;
    });
  },
};
