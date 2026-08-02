import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const salaryIncrementRepository = {
  findByEmployee: (employeeId: string) =>
    prisma.salaryIncrement.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: "desc" },
    }),

  /** Latest increment with effectiveDate <= asOf — the salary that was actually in effect on that date. */
  findEffectiveAsOf: (tx: Prisma.TransactionClient, employeeId: string, asOf: Date) =>
    tx.salaryIncrement.findFirst({
      where: { employeeId, effectiveDate: { lte: asOf } },
      orderBy: { effectiveDate: "desc" },
    }),

  /** Most recent increment overall, used to decide whether a new one becomes the employee's "current" salary. */
  findLatest: (tx: Prisma.TransactionClient, employeeId: string) =>
    tx.salaryIncrement.findFirst({
      where: { employeeId },
      orderBy: { effectiveDate: "desc" },
    }),

  create: (tx: Prisma.TransactionClient, data: Prisma.SalaryIncrementUncheckedCreateInput) =>
    tx.salaryIncrement.create({ data }),
};
