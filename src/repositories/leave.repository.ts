import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const leaveRepository = {
  findByEmployee: (employeeId: string) =>
    prisma.leaveRecord.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { fromDate: "desc" },
    }),

  findMany: (args: Prisma.LeaveRecordFindManyArgs) =>
    prisma.leaveRecord.findMany({ ...args, where: { ...args.where, deletedAt: null }, include: { employee: true } }),

  findById: (id: string) => prisma.leaveRecord.findUnique({ where: { id } }),

  count: (where: Prisma.LeaveRecordWhereInput) =>
    prisma.leaveRecord.count({ where: { ...where, deletedAt: null } }),

  /** Leaves that overlap [periodStart, periodEnd] at all, for clipping into that window. */
  findOverlapping: (employeeId: string, periodStart: Date, periodEnd: Date) =>
    prisma.leaveRecord.findMany({
      where: { employeeId, deletedAt: null, fromDate: { lte: periodEnd }, toDate: { gte: periodStart } },
    }),

  create: (data: Prisma.LeaveRecordUncheckedCreateInput) => prisma.leaveRecord.create({ data }),

  update: (id: string, data: Prisma.LeaveRecordUpdateInput) =>
    prisma.leaveRecord.update({ where: { id }, data }),

  softDelete: (id: string, deletedById: string, deletionReason?: string | null) =>
    prisma.leaveRecord.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById, deletionReason: deletionReason ?? null },
    }),

  /** True if a (non-deleted) SalaryRecord already exists for any month a leave's date range touches — payroll for that period is locked in. */
  hasLockedSalaryForRange: async (employeeId: string, fromDate: Date, toDate: Date) => {
    const months = new Set<string>();
    let cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    while (cursor <= end) {
      months.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    const records = await prisma.salaryRecord.findMany({
      where: { employeeId, deletedAt: null },
      select: { month: true, year: true },
    });

    return records.some((r) => months.has(`${r.year}-${r.month}`));
  },
};
