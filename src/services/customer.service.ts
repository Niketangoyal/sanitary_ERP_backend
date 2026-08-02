import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { customerRepository } from "../repositories/customer.repository";
import { ledgerRepository } from "../repositories/ledger.repository";
import { ledgerService } from "./ledger.service";
import { AppError } from "../utils/AppError";
import { roundNum2 } from "../utils/money";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateCustomerInput, UpdateCustomerInput } from "../utils/validators/customer.schema";

interface ListCustomerQuery extends PaginationQuery {
  search?: string;
  isActive?: "true" | "false";
}

export const customerService = {
  async list(query: ListCustomerQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.CustomerWhereInput = {
      ...(query.isActive ? { isActive: query.isActive === "true" } : {}),
      ...(query.search
        ? {
            OR: [
              { companyName: { contains: query.search, mode: "insensitive" } },
              { contactPerson: { contains: query.search, mode: "insensitive" } },
              { mobile: { contains: query.search, mode: "insensitive" } },
              { gstNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      customerRepository.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      customerRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async recent() {
    return customerRepository.recent(5);
  },

  async getById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw AppError.notFound("Customer not found");

    const [balances, salesAgg, paymentsAgg] = await Promise.all([
      ledgerRepository.getCurrentBalances(id),
      prisma.sale.aggregate({ where: { customerId: id }, _sum: { grandTotal: true } }),
      prisma.payment.aggregate({ where: { customerId: id }, _sum: { amount: true } }),
    ]);

    return {
      customer,
      cashBalance: balances.cashBalance,
      billBalance: balances.billBalance,
      totalOutstanding: roundNum2(balances.cashBalance + balances.billBalance),
      totalSales: roundNum2(Number(salesAgg._sum.grandTotal ?? 0)),
      totalPayments: roundNum2(Number(paymentsAgg._sum.amount ?? 0)),
    };
  },

  async create(input: CreateCustomerInput) {
    return prisma.$transaction(async (tx) => {
      const customer = await customerRepository.create(tx, {
        companyName: input.companyName,
        contactPerson: input.contactPerson ?? null,
        mobile: input.mobile,
        address: input.address ?? null,
        gstNumber: input.gstNumber ?? null,
        openingCashBalance: input.openingCashBalance,
        openingBillBalance: input.openingBillBalance,
        notes: input.notes ?? null,
      });

      if (input.openingCashBalance !== 0 || input.openingBillBalance !== 0) {
        await ledgerService.postOpeningBalances(tx, {
          customerId: customer.id,
          openingCashBalance: input.openingCashBalance,
          openingBillBalance: input.openingBillBalance,
          date: customer.createdAt,
        });
      }

      return customer;
    });
  },

  async update(id: string, input: UpdateCustomerInput, updatedById?: string) {
    const existing = await customerRepository.findById(id);
    if (!existing) throw AppError.notFound("Customer not found");

    return customerRepository.update(id, {
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /**
   * Soft delete — customers are never hard-removed since they carry
   * sales/payment/ledger history. If the customer still has a nonzero
   * outstanding balance, the caller must pass `force` (a second confirm
   * step in the UI) to proceed anyway.
   */
  async remove(id: string, deletedById: string, force = false, reason?: string) {
    const existing = await customerRepository.findById(id);
    if (!existing) throw AppError.notFound("Customer not found");
    if (existing.deletedAt) throw AppError.badRequest("This customer has already been deleted");

    if (!force) {
      const balances = await ledgerRepository.getCurrentBalances(id);
      const outstanding = roundNum2(balances.cashBalance + balances.billBalance);
      if (outstanding !== 0) {
        throw AppError.conflict(
          `This customer has an outstanding balance of ${outstanding}. Confirm again to delete anyway.`,
        );
      }
    }

    await customerRepository.softDelete(id, deletedById, reason);
  },
};
