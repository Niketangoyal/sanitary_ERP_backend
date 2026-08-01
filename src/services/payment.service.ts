import { Prisma, PaymentMode } from "@prisma/client";
import { prisma } from "../config/prisma";
import { paymentRepository } from "../repositories/payment.repository";
import { customerRepository } from "../repositories/customer.repository";
import { ledgerService } from "./ledger.service";
import { settingsService } from "./settings.service";
import { AppError } from "../utils/AppError";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { ACCOUNT_TYPE_LABELS, PAYMENT_MODE_LABELS } from "../utils/labels";
import { CreatePaymentInput } from "../utils/validators/payment.schema";

interface ListPaymentQuery extends PaginationQuery {
  customerId?: string;
  mode?: string;
  from?: string;
  to?: string;
}

export const paymentService = {
  async list(query: ListPaymentQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.PaymentWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.mode ? { mode: query.mode as PaymentMode } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      paymentRepository.findMany({
        where,
        orderBy: { date: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      paymentRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async recent() {
    return paymentRepository.recent(5);
  },

  async getById(id: string) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw AppError.notFound("Payment not found");
    return payment;
  },

  async create(input: CreatePaymentInput) {
    const customer = await customerRepository.findById(input.customerId);
    if (!customer) throw AppError.notFound("Customer not found");

    const settings = await settingsService.getOrCreate();

    return prisma.$transaction(async (tx) => {
      const paymentNumber = await nextDocumentNumber(tx, "PAYMENT", settings.paymentPrefix, input.date);

      const payment = await paymentRepository.create(tx, {
        paymentNumber,
        customerId: input.customerId,
        date: input.date,
        amount: input.amount,
        mode: input.mode,
        accountType: input.accountType,
        remarks: input.remarks ?? null,
      });

      await ledgerService.postEntry(tx, {
        customerId: input.customerId,
        entryDate: input.date,
        type: "PAYMENT",
        accountType: input.accountType,
        description: `Payment Received - ${PAYMENT_MODE_LABELS[input.mode]} (${ACCOUNT_TYPE_LABELS[input.accountType]})`,
        referenceNumber: paymentNumber,
        debit: 0,
        credit: input.amount,
        paymentId: payment.id,
      });

      return payment;
    });
  },
};
