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
import { CreatePaymentInput, UpdatePaymentInput } from "../utils/validators/payment.schema";

interface ListPaymentQuery extends PaginationQuery {
  search?: string;
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
      ...(query.search
        ? {
            OR: [
              { paymentNumber: { contains: query.search, mode: "insensitive" } },
              { customer: { companyName: { contains: query.search, mode: "insensitive" } } },
            ],
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

  /**
   * Records a payment against the customer's Cash or Bill account as a
   * whole (Khata-style) — never allocated to a specific invoice. The
   * ledger's running balance is what "Total Sales − Total Payments +
   * Adjustments" resolves to; there's nothing else to compute here.
   */
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

  /** Full reverse-and-repost edit: undoes the old ledger effect, then reposts with the new values. */
  async update(id: string, input: UpdatePaymentInput, updatedById?: string) {
    const existing = await paymentRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment not found");
    if (existing.deletedAt) throw AppError.badRequest("This payment has been deleted");

    const date = input.date ?? existing.date;
    const amount = input.amount ?? Number(existing.amount);
    const mode = input.mode ?? existing.mode;
    const accountType = input.accountType ?? existing.accountType;
    const remarks = input.remarks !== undefined ? input.remarks : existing.remarks;

    return prisma.$transaction(async (tx) => {
      await ledgerService.reverseEntriesFor(tx, { paymentId: id });

      const updated = await paymentRepository.update(tx, id, {
        date,
        amount,
        mode,
        accountType,
        remarks,
        ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
      });

      await ledgerService.postEntry(tx, {
        customerId: existing.customerId,
        entryDate: date,
        type: "PAYMENT",
        accountType,
        description: `Payment Received - ${PAYMENT_MODE_LABELS[mode]} (${ACCOUNT_TYPE_LABELS[accountType]})`,
        referenceNumber: existing.paymentNumber,
        debit: 0,
        credit: amount,
        paymentId: id,
      });

      return updated;
    });
  },

  /** Soft delete: reverses the ledger effect, then marks the row deleted (kept for audit). */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await paymentRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment not found");
    if (existing.deletedAt) throw AppError.badRequest("This payment has already been deleted");

    return prisma.$transaction(async (tx) => {
      await ledgerService.reverseEntriesFor(tx, { paymentId: id });
      return paymentRepository.softDelete(tx, id, deletedById, reason);
    });
  },
};
