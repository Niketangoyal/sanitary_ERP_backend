import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const employeeRepository = {
  create: (tx: Prisma.TransactionClient, data: Prisma.EmployeeCreateInput) =>
    tx.employee.create({ data }),

  findMany: (args: Prisma.EmployeeFindManyArgs) => prisma.employee.findMany(args),

  count: (where: Prisma.EmployeeWhereInput) => prisma.employee.count({ where }),

  findById: (id: string) => prisma.employee.findUnique({ where: { id } }),

  update: (id: string, data: Prisma.EmployeeUpdateInput) =>
    prisma.employee.update({ where: { id }, data }),

  updateCurrentSalary: (tx: Prisma.TransactionClient, id: string, currentSalary: Prisma.Decimal.Value) =>
    tx.employee.update({ where: { id }, data: { currentSalary } }),

  remove: (id: string) => prisma.employee.delete({ where: { id } }),
};
