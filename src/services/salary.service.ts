import dayjs from "dayjs";
import { Prisma, SalaryPaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { salaryRepository } from "../repositories/salary.repository";
import { employeeRepository } from "../repositories/employee.repository";
import { salaryIncrementService } from "./salaryIncrement.service";
import { advanceService } from "./advance.service";
import { leaveService } from "./leave.service";
import { AppError } from "../utils/AppError";
import { toDecimal, round2 } from "../utils/money";
import { nextDocumentNumber } from "../utils/documentNumber";
import { parsePagination, buildPaginatedResult, PaginationQuery } from "../utils/pagination";
import {
  GenerateSalaryInput,
  PaySalaryInput,
  UpdateSalaryRecordInput,
  UpdateSalaryPaymentInput,
} from "../utils/validators/salary.schema";

interface ListSalaryQuery extends PaginationQuery {
  employeeId?: string;
  month?: string;
  year?: string;
  paymentStatus?: string;
}

export const salaryService = {
  async list(query: ListSalaryQuery) {
    const pagination = parsePagination(query);

    const where: Prisma.SalaryRecordWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.month ? { month: parseInt(query.month, 10) } : {}),
      ...(query.year ? { year: parseInt(query.year, 10) } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as never } : {}),
    };

    const [data, total] = await Promise.all([
      salaryRepository.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      salaryRepository.count(where),
    ]);

    return buildPaginatedResult(data, total, pagination);
  },

  async listForEmployee(employeeId: string) {
    return salaryRepository.findMany({ where: { employeeId }, orderBy: [{ year: "desc" }, { month: "desc" }] });
  },

  async getById(id: string) {
    const record = await salaryRepository.findById(id);
    if (!record) throw AppError.notFound("Salary record not found");
    return record;
  },

  async generate(employeeId: string, input: GenerateSalaryInput, processedById: string) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw AppError.notFound("Employee not found");

    return prisma.$transaction(async (tx) => {
      const existing = await salaryRepository.findByEmployeeMonthYear(tx, employeeId, input.month, input.year);
      if (existing) {
        throw AppError.conflict(
          `Salary for ${input.month}/${input.year} has already been generated for this employee`,
        );
      }

      const periodStart = dayjs(`${input.year}-${String(input.month).padStart(2, "0")}-01`).startOf("month");
      const periodEnd = periodStart.endOf("month");

      const effectiveSalary = await salaryIncrementService.effectiveSalaryOn(
        tx,
        employeeId,
        periodEnd.toDate(),
      );
      if (effectiveSalary.lte(0)) {
        throw AppError.badRequest(
          "No salary is defined for this employee as of the selected period — check the date of joining",
        );
      }

      const { paidDays, unpaidDays } = await leaveService.getLeaveDaysForPeriod(
        employeeId,
        periodStart.toDate(),
        periodEnd.toDate(),
      );

      const daysInMonth = periodEnd.date();
      const leaveDeduction =
        unpaidDays > 0 ? round2(effectiveSalary.div(daysInMonth).mul(unpaidDays)) : toDecimal(0);

      const netBeforeAdvance = round2(effectiveSalary.sub(leaveDeduction));

      // Advance deduction this run is admin-chosen, not automatic — validate
      // it against both the payable salary and what's actually outstanding.
      const requestedAdjustment = round2(toDecimal(input.advanceAdjustment));
      if (requestedAdjustment.gt(netBeforeAdvance)) {
        throw AppError.badRequest("Advance adjustment cannot exceed the employee's payable salary");
      }
      if (requestedAdjustment.gt(0)) {
        const { totalPending } = await advanceService.getPendingSummary(employeeId);
        if (requestedAdjustment.gt(totalPending)) {
          throw AppError.badRequest(
            `Advance adjustment cannot exceed the pending advance balance (${totalPending})`,
          );
        }
      }

      const netPay = round2(netBeforeAdvance.sub(requestedAdjustment));
      const salaryNumber = await nextDocumentNumber(tx, "SALARY", "SAL", periodEnd.toDate());

      const record = await salaryRepository.create(tx, {
        salaryNumber,
        employeeId,
        month: input.month,
        year: input.year,
        baseSalary: effectiveSalary,
        paidLeaveDays: paidDays,
        unpaidLeaveDays: unpaidDays,
        leaveDeduction,
        advanceDeduction: requestedAdjustment,
        grossSalary: effectiveSalary,
        netPay,
        amountPaid: 0,
        balanceDue: netPay,
        paymentStatus: "PENDING",
      });

      if (requestedAdjustment.gt(0)) {
        await advanceService.applyAdjustment(tx, employeeId, requestedAdjustment, record.id, processedById);
      }

      return record;
    }, { timeout: 30000 });
  },

  async pay(salaryRecordId: string, input: PaySalaryInput, recordedById: string) {
    const record = await salaryRepository.findById(salaryRecordId);
    if (!record) throw AppError.notFound("Salary record not found");

    const balanceDue = toDecimal(record.balanceDue);
    if (balanceDue.lte(0)) {
      throw AppError.badRequest("This salary has already been fully paid");
    }
    if (toDecimal(input.amount).gt(balanceDue)) {
      throw AppError.badRequest(`Amount cannot exceed the balance due (${record.balanceDue})`);
    }

    return prisma.$transaction(async (tx) => {
      await salaryRepository.createPayment(tx, {
        salaryRecordId,
        amount: input.amount,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        remarks: input.remarks ?? null,
        recordedById,
      });

      const newAmountPaid = round2(toDecimal(record.amountPaid).add(input.amount));
      const newBalanceDue = round2(toDecimal(record.netPay).sub(newAmountPaid));
      const newStatus: SalaryPaymentStatus = newBalanceDue.lte(0)
        ? "PAID"
        : newAmountPaid.gt(0)
          ? "PARTIAL"
          : "PENDING";

      return salaryRepository.update(tx, salaryRecordId, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue.lt(0) ? 0 : newBalanceDue,
        paymentStatus: newStatus,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
      });
    }, { timeout: 15000 });
  },

  /**
   * Only the advance deduction and notes can be corrected, and only before
   * any installment has been paid ("before payroll is finalized") — gross
   * salary and leave figures are locked in at generation time. Reverses the
   * old AdvanceAdjustment(s) and reapplies against the new amount.
   */
  async update(id: string, input: UpdateSalaryRecordInput, updatedById: string) {
    const record = await salaryRepository.findById(id);
    if (!record) throw AppError.notFound("Salary record not found");
    if (record.deletedAt) throw AppError.badRequest("This salary record has been deleted");
    if (toDecimal(record.amountPaid).gt(0)) {
      throw AppError.badRequest(
        "This salary has already had payments recorded and can no longer be edited. Remove the payment(s) first if a correction is truly needed.",
      );
    }

    const netBeforeAdvance = round2(toDecimal(record.grossSalary).sub(record.leaveDeduction));
    const requestedAdjustment = round2(toDecimal(input.advanceAdjustment));
    if (requestedAdjustment.gt(netBeforeAdvance)) {
      throw AppError.badRequest("Advance adjustment cannot exceed the employee's payable salary");
    }

    return prisma.$transaction(async (tx) => {
      await advanceService.reverseAdjustmentsForSalaryRecord(tx, id);

      if (requestedAdjustment.gt(0)) {
        const { totalPending } = await advanceService.getPendingSummary(record.employeeId);
        if (requestedAdjustment.gt(totalPending)) {
          throw AppError.badRequest(
            `Advance adjustment cannot exceed the pending advance balance (${totalPending})`,
          );
        }
      }

      const applied =
        requestedAdjustment.gt(0)
          ? await advanceService.applyAdjustment(tx, record.employeeId, requestedAdjustment, id, updatedById)
          : toDecimal(0);

      const netPay = round2(netBeforeAdvance.sub(applied));

      return salaryRepository.update(tx, id, {
        advanceDeduction: applied,
        netPay,
        balanceDue: netPay,
        notes: input.notes !== undefined ? input.notes : record.notes,
        updatedBy: { connect: { id: updatedById } },
      });
    }, { timeout: 30000 });
  },

  /** Blocked outright if any payment has been recorded — remove installments first. */
  async remove(id: string, deletedById: string, reason?: string) {
    const record = await salaryRepository.findById(id);
    if (!record) throw AppError.notFound("Salary record not found");
    if (record.deletedAt) throw AppError.badRequest("This salary record has already been deleted");
    if (toDecimal(record.amountPaid).gt(0)) {
      throw AppError.conflict(
        "This salary has payments recorded against it and cannot be deleted. Remove the payment(s) first.",
      );
    }

    return prisma.$transaction(async (tx) => {
      await advanceService.reverseAdjustmentsForSalaryRecord(tx, id);
      return salaryRepository.softDelete(tx, id, deletedById, reason);
    }, { timeout: 30000 });
  },

  /** Recomputes the parent record's amountPaid/balanceDue/status after an installment's amount changes. */
  async updatePayment(paymentId: string, input: UpdateSalaryPaymentInput) {
    const payment = await salaryRepository.findPaymentById(paymentId);
    if (!payment) throw AppError.notFound("Salary payment not found");
    if (payment.deletedAt) throw AppError.badRequest("This payment has been deleted");

    const record = await salaryRepository.findById(payment.salaryRecordId);
    if (!record) throw AppError.notFound("Salary record not found");

    const newAmountPaid = round2(toDecimal(record.amountPaid).sub(payment.amount).add(input.amount));
    if (newAmountPaid.gt(record.netPay)) {
      throw AppError.badRequest(`Total paid cannot exceed the net salary (${record.netPay})`);
    }
    if (newAmountPaid.lt(0)) {
      throw AppError.badRequest("Amount cannot be negative");
    }

    return prisma.$transaction(async (tx) => {
      await salaryRepository.updatePayment(tx, paymentId, {
        amount: input.amount,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        remarks: input.remarks ?? null,
      });

      const newBalanceDue = round2(toDecimal(record.netPay).sub(newAmountPaid));
      const newStatus: SalaryPaymentStatus = newAmountPaid.lte(0)
        ? "PENDING"
        : newBalanceDue.lte(0)
          ? "PAID"
          : "PARTIAL";

      return salaryRepository.update(tx, record.id, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue.lt(0) ? 0 : newBalanceDue,
        paymentStatus: newStatus,
      });
    }, { timeout: 15000 });
  },

  /** Soft-deletes an installment and recomputes the parent record's totals/status. */
  async deletePayment(paymentId: string, deletedById: string, reason?: string) {
    const payment = await salaryRepository.findPaymentById(paymentId);
    if (!payment) throw AppError.notFound("Salary payment not found");
    if (payment.deletedAt) throw AppError.badRequest("This payment has already been deleted");

    const record = await salaryRepository.findById(payment.salaryRecordId);
    if (!record) throw AppError.notFound("Salary record not found");

    return prisma.$transaction(async (tx) => {
      await salaryRepository.softDeletePayment(tx, paymentId, deletedById, reason);

      const newAmountPaid = round2(toDecimal(record.amountPaid).sub(payment.amount));
      const clampedAmountPaid = newAmountPaid.lt(0) ? toDecimal(0) : newAmountPaid;
      const newBalanceDue = round2(toDecimal(record.netPay).sub(clampedAmountPaid));
      const newStatus: SalaryPaymentStatus = clampedAmountPaid.lte(0)
        ? "PENDING"
        : newBalanceDue.lte(0)
          ? "PAID"
          : "PARTIAL";

      return salaryRepository.update(tx, record.id, {
        amountPaid: clampedAmountPaid,
        balanceDue: newBalanceDue.lt(0) ? 0 : newBalanceDue,
        paymentStatus: newStatus,
      });
    }, { timeout: 15000 });
  },
};
