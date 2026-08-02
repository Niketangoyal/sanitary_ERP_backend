import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { salaryIncrementRepository } from "../repositories/salaryIncrement.repository";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/AppError";
import { toDecimal } from "../utils/money";
import { CreateIncrementInput } from "../utils/validators/salaryIncrement.schema";

export const salaryIncrementService = {
  async list(employeeId: string) {
    return salaryIncrementRepository.findByEmployee(employeeId);
  },

  /** The salary actually in effect on a given date — falls back to 0 if the employee had no increment yet by then. */
  async effectiveSalaryOn(
    tx: Prisma.TransactionClient,
    employeeId: string,
    asOf: Date,
  ): Promise<Prisma.Decimal> {
    const increment = await salaryIncrementRepository.findEffectiveAsOf(tx, employeeId, asOf);
    return increment ? toDecimal(increment.newSalary) : toDecimal(0);
  },

  async create(employeeId: string, input: CreateIncrementInput) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw AppError.notFound("Employee not found");

    return prisma.$transaction(async (tx) => {
      const previous = await salaryIncrementRepository.findEffectiveAsOf(tx, employeeId, input.effectiveDate);
      const previousSalary = previous ? previous.newSalary : 0;

      const increment = await salaryIncrementRepository.create(tx, {
        employeeId,
        previousSalary,
        newSalary: input.newSalary,
        effectiveDate: input.effectiveDate,
        reason: input.reason ?? null,
      });

      const latest = await salaryIncrementRepository.findLatest(tx, employeeId);
      if (latest?.id === increment.id) {
        await employeeRepository.updateCurrentSalary(tx, employeeId, input.newSalary);
      }

      return increment;
    });
  },
};
