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

    const balances = await ledgerRepository.getCurrentBalances(id);
    return {
      customer,
      cashBalance: balances.cashBalance,
      billBalance: balances.billBalance,
      totalOutstanding: roundNum2(balances.cashBalance + balances.billBalance),
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

  async update(id: string, input: UpdateCustomerInput) {
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
    });
  },

  async remove(id: string) {
    const existing = await customerRepository.findById(id);
    if (!existing) throw AppError.notFound("Customer not found");

    try {
      await customerRepository.remove(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw AppError.conflict(
          "This customer has sales, returns, payments or ledger history and cannot be deleted. Mark it inactive instead.",
        );
      }
      throw err;
    }
  },
};
