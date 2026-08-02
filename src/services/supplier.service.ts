import { Prisma } from "@prisma/client";
import { supplierRepository } from "../repositories/supplier.repository";
import { AppError } from "../utils/AppError";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateSupplierInput, UpdateSupplierInput } from "../utils/validators/supplier.schema";

interface ListSupplierQuery extends PaginationQuery {
  search?: string;
  isActive?: "true" | "false";
}

export const supplierService = {
  async list(query: ListSupplierQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.SupplierWhereInput = {
      ...(query.isActive ? { isActive: query.isActive === "true" } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { contactPerson: { contains: query.search, mode: "insensitive" } },
              { mobile: { contains: query.search, mode: "insensitive" } },
              { gstNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      supplierRepository.findMany({
        where,
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      supplierRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async getById(id: string) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw AppError.notFound("Supplier not found");
    return supplier;
  },

  async create(input: CreateSupplierInput, createdById?: string) {
    return supplierRepository.create({
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      gstNumber: input.gstNumber ?? null,
      notes: input.notes ?? null,
      ...(createdById ? { createdBy: { connect: { id: createdById } } } : {}),
    });
  },

  async update(id: string, input: UpdateSupplierInput, updatedById?: string) {
    const existing = await supplierRepository.findById(id);
    if (!existing) throw AppError.notFound("Supplier not found");

    return supplierRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /** Soft delete, blocked outright if any purchase batch references this supplier. */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await supplierRepository.findById(id);
    if (!existing) throw AppError.notFound("Supplier not found");
    if (existing.deletedAt) throw AppError.badRequest("This supplier has already been deleted");

    if (await supplierRepository.hasPurchases(id)) {
      throw AppError.conflict(
        "This supplier has purchase records and cannot be deleted. Mark it inactive instead.",
      );
    }

    await supplierRepository.softDelete(id, deletedById, reason);
  },
};
