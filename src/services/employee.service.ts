import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/AppError";
import { nextEmployeeCode } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateEmployeeInput, UpdateEmployeeInput } from "../utils/validators/employee.schema";

interface ListEmployeeQuery extends PaginationQuery {
  search?: string;
  department?: string;
  employmentStatus?: string;
}

export const employeeService = {
  async list(query: ListEmployeeQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.EmployeeWhereInput = {
      ...(query.department ? { department: query.department } : {}),
      ...(query.employmentStatus ? { employmentStatus: query.employmentStatus as never } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { mobile: { contains: query.search, mode: "insensitive" } },
              { employeeCode: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      employeeRepository.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      employeeRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async getById(id: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw AppError.notFound("Employee not found");
    return employee;
  },

  async create(input: CreateEmployeeInput) {
    return prisma.$transaction(async (tx) => {
      const employeeCode = await nextEmployeeCode(tx);

      const employee = await employeeRepository.create(tx, {
        employeeCode,
        fullName: input.fullName,
        mobile: input.mobile,
        address: input.address ?? null,
        email: input.email || null,
        dateOfJoining: input.dateOfJoining,
        department: input.department ?? null,
        designation: input.designation ?? null,
        salaryType: input.salaryType,
        currentSalary: input.currentSalary,
        employmentStatus: input.employmentStatus,
        notes: input.notes ?? null,
      });

      await tx.salaryIncrement.create({
        data: {
          employeeId: employee.id,
          previousSalary: 0,
          newSalary: input.currentSalary,
          effectiveDate: input.dateOfJoining,
          reason: "Initial Salary",
        },
      });

      return employee;
    });
  },

  async update(id: string, input: UpdateEmployeeInput) {
    const existing = await employeeRepository.findById(id);
    if (!existing) throw AppError.notFound("Employee not found");

    return employeeRepository.update(id, {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.designation !== undefined ? { designation: input.designation } : {}),
      ...(input.salaryType !== undefined ? { salaryType: input.salaryType } : {}),
      ...(input.employmentStatus !== undefined ? { employmentStatus: input.employmentStatus } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
  },

  async remove(id: string) {
    const existing = await employeeRepository.findById(id);
    if (!existing) throw AppError.notFound("Employee not found");

    try {
      await employeeRepository.remove(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw AppError.conflict(
          "This employee has salary, advance or leave history and cannot be deleted. Mark them as Left instead.",
        );
      }
      throw err;
    }
  },
};
