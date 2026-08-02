import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const salaryWithRelations = {
  employee: true,
  payments: {
    where: { deletedAt: null },
    orderBy: { paymentDate: "asc" },
    include: { recordedBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.SalaryRecordInclude;

export const salaryRepository = {
  findByEmployeeMonthYear: (tx: Prisma.TransactionClient, employeeId: string, month: number, year: number) =>
    tx.salaryRecord.findUnique({ where: { employeeId_month_year: { employeeId, month, year } } }),

  create: (tx: Prisma.TransactionClient, data: Prisma.SalaryRecordUncheckedCreateInput) =>
    tx.salaryRecord.create({ data, include: salaryWithRelations }),

  findMany: (args: Prisma.SalaryRecordFindManyArgs) =>
    prisma.salaryRecord.findMany({ ...args, where: { ...args.where, deletedAt: null }, include: { employee: true } }),

  count: (where: Prisma.SalaryRecordWhereInput) => prisma.salaryRecord.count({ where: { ...where, deletedAt: null } }),

  findById: (id: string) =>
    prisma.salaryRecord.findUnique({ where: { id }, include: salaryWithRelations }),

  update: (tx: Prisma.TransactionClient, id: string, data: Prisma.SalaryRecordUpdateInput) =>
    tx.salaryRecord.update({ where: { id }, data, include: salaryWithRelations }),

  softDelete: (tx: Prisma.TransactionClient, id: string, deletedById: string, deletionReason?: string | null) =>
    tx.salaryRecord.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  createPayment: (tx: Prisma.TransactionClient, data: Prisma.SalaryPaymentUncheckedCreateInput) =>
    tx.salaryPayment.create({ data }),

  findPaymentById: (id: string) => prisma.salaryPayment.findUnique({ where: { id } }),

  updatePayment: (tx: Prisma.TransactionClient, id: string, data: Prisma.SalaryPaymentUpdateInput) =>
    tx.salaryPayment.update({ where: { id }, data }),

  softDeletePayment: (tx: Prisma.TransactionClient, id: string, deletedById: string, deletionReason?: string | null) =>
    tx.salaryPayment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),
};
