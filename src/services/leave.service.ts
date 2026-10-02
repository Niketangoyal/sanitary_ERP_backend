import dayjs from "dayjs";
import { leaveRepository } from "../repositories/leave.repository";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/AppError";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import { CreateLeaveInput, UpdateLeaveInput } from "../utils/validators/leave.schema";

const inclusiveDays = (from: Date, to: Date): number => dayjs(to).diff(dayjs(from), "day") + 1;

interface ListLeaveQuery extends PaginationQuery {
  employeeId?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
}

/** Shared by list() and listAll() (export) so pagination and CSV/PDF export never drift apart. */
const buildLeaveWhere = (query: ListLeaveQuery) => {
  let from: Date | undefined;
  let to: Date | undefined;
  if (query.month && query.year) {
    const start = dayjs(`${query.year}-${query.month}-01`).startOf("month");
    from = start.toDate();
    to = start.endOf("month").toDate();
  } else {
    from = query.from ? new Date(query.from) : undefined;
    to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;
  }

  return {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(from || to ? { fromDate: { lte: to }, toDate: { gte: from } } : {}),
  };
};

export const leaveService = {
  async listForEmployee(employeeId: string) {
    return leaveRepository.findByEmployee(employeeId);
  },

  async list(query: ListLeaveQuery) {
    const pagination = parsePagination(query);
    const where = buildLeaveWhere(query);

    const [data, total] = await Promise.all([
      leaveRepository.findMany({
        where,
        orderBy: { fromDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      leaveRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  /** Unpaginated — for PDF/CSV export, so the file matches whatever's on screen. */
  async listAll(query: ListLeaveQuery) {
    const where = buildLeaveWhere(query);
    return leaveRepository.findMany({ where, orderBy: { fromDate: "desc" } });
  },

  /** Paid vs unpaid leave days for an employee, clipped to [periodStart, periodEnd] — used by salary generation. */
  async getLeaveDaysForPeriod(employeeId: string, periodStart: Date, periodEnd: Date) {
    const leaves = await leaveRepository.findOverlapping(employeeId, periodStart, periodEnd);

    let paidDays = 0;
    let unpaidDays = 0;

    for (const leave of leaves) {
      const overlapStart = leave.fromDate > periodStart ? leave.fromDate : periodStart;
      const overlapEnd = leave.toDate < periodEnd ? leave.toDate : periodEnd;
      if (overlapStart > overlapEnd) continue;

      const days = inclusiveDays(overlapStart, overlapEnd);
      if (leave.leaveType === "UNPAID") {
        unpaidDays += days;
      } else {
        paidDays += days;
      }
    }

    return { paidDays, unpaidDays };
  },

  async create(employeeId: string, input: CreateLeaveInput, recordedById: string) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw AppError.notFound("Employee not found");

    return leaveRepository.create({
      employeeId,
      leaveType: input.leaveType,
      fromDate: input.fromDate,
      toDate: input.toDate,
      totalDays: inclusiveDays(input.fromDate, input.toDate),
      reason: input.reason ?? null,
      recordedById,
    });
  },

  async getById(id: string) {
    const record = await leaveRepository.findById(id);
    if (!record) throw AppError.notFound("Leave record not found");
    return record;
  },

  /**
   * Blocked once payroll has already been generated for any month this
   * leave's date range touches — its days are baked into that SalaryRecord's
   * leaveDeduction, and changing it after the fact would silently desync
   * the two. Correct by regenerating a future period instead.
   */
  async update(id: string, input: UpdateLeaveInput, updatedById?: string) {
    const existing = await leaveRepository.findById(id);
    if (!existing) throw AppError.notFound("Leave record not found");
    if (existing.deletedAt) throw AppError.badRequest("This leave record has been deleted");

    const fromDate = input.fromDate ?? existing.fromDate;
    const toDate = input.toDate ?? existing.toDate;

    if (await leaveRepository.hasLockedSalaryForRange(existing.employeeId, existing.fromDate, existing.toDate)) {
      throw AppError.conflict(
        "Payroll has already been generated for a month this leave falls in and it can no longer be edited.",
      );
    }
    if (
      (input.fromDate !== undefined || input.toDate !== undefined) &&
      (await leaveRepository.hasLockedSalaryForRange(existing.employeeId, fromDate, toDate))
    ) {
      throw AppError.conflict("The new dates fall in a month payroll has already been generated for.");
    }

    return leaveRepository.update(id, {
      ...(input.leaveType !== undefined ? { leaveType: input.leaveType } : {}),
      ...(input.fromDate !== undefined ? { fromDate: input.fromDate } : {}),
      ...(input.toDate !== undefined ? { toDate: input.toDate } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      totalDays: inclusiveDays(fromDate, toDate),
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /** Same payroll-lock guard as update; soft delete only (kept for audit). */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await leaveRepository.findById(id);
    if (!existing) throw AppError.notFound("Leave record not found");
    if (existing.deletedAt) throw AppError.badRequest("This leave record has already been deleted");

    if (await leaveRepository.hasLockedSalaryForRange(existing.employeeId, existing.fromDate, existing.toDate)) {
      throw AppError.conflict(
        "Payroll has already been generated for a month this leave falls in and it can no longer be deleted.",
      );
    }

    await leaveRepository.softDelete(id, deletedById, reason);
  },
};
