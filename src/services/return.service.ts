import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { returnRepository } from "../repositories/return.repository";
import { customerRepository } from "../repositories/customer.repository";
import { productRepository } from "../repositories/product.repository";
import { ledgerService } from "./ledger.service";
import { settingsService } from "./settings.service";
import { AppError } from "../utils/AppError";
import { computeLineItem, toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateReturnInput } from "../utils/validators/return.schema";

interface ListReturnQuery extends PaginationQuery {
  search?: string;
  customerId?: string;
  from?: string;
  to?: string;
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

  async create(input: CreateReturnInput) {
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

    const subtotal = lineItems.reduce((sum, li) => sum.add(li.quantity.mul(li.rate)), toDecimal(0));
    const gstTotal = lineItems.reduce((sum, li) => sum.add(li.gstAmount), toDecimal(0));
    const grandTotal = lineItems.reduce((sum, li) => sum.add(li.total), toDecimal(0));

    const settings = await settingsService.getOrCreate();

    return prisma.$transaction(async (tx) => {
      const returnNumber = await nextDocumentNumber(
        tx,
        "RETURN",
        settings.returnPrefix,
        input.returnDate,
      );

      const returnDoc = await returnRepository.create(tx, {
        returnNumber,
        returnDate: input.returnDate,
        reason: input.reason ?? null,
        subtotal: round2(subtotal),
        gstTotal: round2(gstTotal),
        grandTotal: round2(grandTotal),
        customer: { connect: { id: input.customerId } },
        ...(input.saleId ? { sale: { connect: { id: input.saleId } } } : {}),
        items: { create: lineItems },
      });

      await ledgerService.postEntry(tx, {
        customerId: input.customerId,
        entryDate: input.returnDate,
        type: "RETURN",
        accountType: "BILL",
        description: `Sales Return ${returnNumber}`,
        referenceNumber: returnNumber,
        debit: 0,
        credit: returnDoc.grandTotal,
        returnId: returnDoc.id,
      });

      return returnDoc;
    });
  },
};
