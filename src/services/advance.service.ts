import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { advanceRepository } from "../repositories/advance.repository";
import { employeeRepository } from "../repositories/employee.repository";
import { AppError } from "../utils/AppError";
import { toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { CreateAdvanceInput, UpdateAdvanceInput } from "../utils/validators/advance.schema";

export const advanceService = {
  async list(employeeId: string) {
    return advanceRepository.findByEmployee(employeeId);
  },

  async getById(id: string) {
    const advance = await advanceRepository.findById(id);
    if (!advance) throw AppError.notFound("Advance not found");
    return advance;
  },

  async create(employeeId: string, input: CreateAdvanceInput, createdById?: string) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw AppError.notFound("Employee not found");

    return prisma.$transaction(async (tx) => {
      const advanceNumber = await nextDocumentNumber(tx, "ADVANCE", "ADV", input.date);

      return advanceRepository.create(tx, {
        advanceNumber,
        employeeId,
        date: input.date,
        amount: input.amount,
        reason: input.reason ?? null,
        ...(createdById ? { createdById } : {}),
      });
    });
  },

  /** Amount is locked once any adjustment has been applied against this advance; date/reason are always safe to correct. */
  async update(id: string, input: UpdateAdvanceInput, updatedById?: string) {
    const existing = await advanceRepository.findById(id);
    if (!existing) throw AppError.notFound("Advance not found");
    if (existing.deletedAt) throw AppError.badRequest("This advance has been deleted");

    if (input.amount !== undefined && toDecimal(existing.adjustedAmount).gt(0)) {
      throw AppError.badRequest(
        "This advance has already been partially or fully adjusted against a salary run and its amount can no longer be edited.",
      );
    }

    return advanceRepository.update(id, {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(updatedById ? { updatedBy: { connect: { id: updatedById } } } : {}),
    });
  },

  /** Blocked outright if any of it has already been adjusted against a salary run. */
  async remove(id: string, deletedById: string, reason?: string) {
    const existing = await advanceRepository.findById(id);
    if (!existing) throw AppError.notFound("Advance not found");
    if (existing.deletedAt) throw AppError.badRequest("This advance has already been deleted");

    if (toDecimal(existing.adjustedAmount).gt(0)) {
      throw AppError.conflict(
        "This advance has already been adjusted against a salary run and cannot be deleted.",
      );
    }

    await advanceRepository.softDelete(id, deletedById, reason);
  },

  /** Total outstanding advance for an employee, shown to the admin before they choose a salary-run adjustment. */
  async getPendingSummary(employeeId: string) {
    const advances = await prisma.advancePayment.findMany({
      where: { employeeId, status: { in: ["PENDING", "PARTIALLY_ADJUSTED"] } },
      orderBy: { date: "asc" },
    });

    const totalPending = round2(
      advances.reduce((sum, a) => sum.add(toDecimal(a.amount).sub(a.adjustedAmount)), toDecimal(0)),
    );

    return { totalPending: totalPending.toNumber(), advances };
  },

  /** Cross-employee outstanding advance totals — Pending Advance Report / Remaining Advance Summary. */
  async pendingReport() {
    return advanceRepository.pendingByEmployee();
  },

  async adjustmentHistory(query: {
    employeeId?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.AdvanceAdjustmentWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.month && query.year
        ? { salaryRecord: { month: parseInt(query.month, 10), year: parseInt(query.year, 10) } }
        : {}),
      ...(query.from || query.to
        ? {
            adjustmentDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    };

    return advanceRepository.findAdjustments({ where, orderBy: { adjustmentDate: "desc" } });
  },

  /**
   * Applies an admin-chosen amount against this employee's oldest-outstanding
   * advances first, writing one AdvanceAdjustment row per advance touched.
   * Caller (salary.service) validates the amount against pending balance and
   * payable salary before calling this — must run inside its transaction.
   */
  async applyAdjustment(
    tx: Prisma.TransactionClient,
    employeeId: string,
    requestedAmount: Prisma.Decimal.Value,
    salaryRecordId: string,
    processedById: string,
  ): Promise<Prisma.Decimal> {
    let remaining = toDecimal(requestedAmount);
    if (remaining.lte(0)) return toDecimal(0);

    let totalApplied = toDecimal(0);
    const outstanding = await advanceRepository.findOutstandingOrdered(tx, employeeId);

    for (const advance of outstanding) {
      if (remaining.lte(0)) break;

      const owed = toDecimal(advance.amount).sub(advance.adjustedAmount);
      if (owed.lte(0)) continue;

      const take = Prisma.Decimal.min(owed, remaining);
      const newAdjusted = round2(toDecimal(advance.adjustedAmount).add(take));
      const newStatus = newAdjusted.gte(advance.amount) ? "FULLY_ADJUSTED" : "PARTIALLY_ADJUSTED";

      await advanceRepository.applyAdjustment(tx, advance.id, newAdjusted, newStatus);
      await advanceRepository.createAdjustmentRecord(tx, {
        advanceId: advance.id,
        salaryRecordId,
        employeeId,
        amount: take,
        remainingBalanceAfter: round2(toDecimal(advance.amount).sub(newAdjusted)),
        processedById,
      });

      totalApplied = totalApplied.add(take);
      remaining = remaining.sub(take);
    }

    return round2(totalApplied);
  },

  /**
   * Undoes every AdvanceAdjustment tied to a salary record — restores each
   * touched advance's adjustedAmount/status and removes the audit rows.
   * Used before editing/deleting a SalaryRecord that had an advance
   * deduction applied, so it can be safely re-derived.
   */
  async reverseAdjustmentsForSalaryRecord(tx: Prisma.TransactionClient, salaryRecordId: string) {
    const adjustments = await tx.advanceAdjustment.findMany({ where: { salaryRecordId } });

    for (const adj of adjustments) {
      const advance = await tx.advancePayment.findUniqueOrThrow({ where: { id: adj.advanceId } });
      const restoredAdjusted = toDecimal(advance.adjustedAmount).sub(adj.amount);
      const clamped = restoredAdjusted.lt(0) ? toDecimal(0) : round2(restoredAdjusted);
      const newStatus = clamped.lte(0) ? "PENDING" : clamped.gte(advance.amount) ? "FULLY_ADJUSTED" : "PARTIALLY_ADJUSTED";

      await advanceRepository.applyAdjustment(tx, advance.id, clamped, newStatus);
    }

    await tx.advanceAdjustment.deleteMany({ where: { salaryRecordId } });
  },
};
