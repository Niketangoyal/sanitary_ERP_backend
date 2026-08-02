import dayjs from "dayjs";
import { prisma } from "../config/prisma";
import { saleRepository } from "../repositories/sale.repository";
import { returnRepository } from "../repositories/return.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { reportService } from "./report.service";
import { roundNum2 } from "../utils/money";
import { resolvePeriodRange, PeriodPreset } from "../utils/dateRangePresets";

const LEDGER_TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening Balance",
  SALE: "Sale",
  RETURN: "Return",
  PAYMENT: "Payment",
  ADJUSTMENT: "Adjustment",
};

export const dashboardService = {
  async summary() {
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const [totalCustomers, outstanding, todaySales, todayPayments, todayReturns] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      reportService.outstandingReport(),
      saleRepository.sumGrandTotalInRange(todayStart, todayEnd),
      paymentRepository.sumAmountInRange(todayStart, todayEnd),
      returnRepository.sumGrandTotalInRange(todayStart, todayEnd),
    ]);

    return {
      totalCustomers,
      totalOutstanding: roundNum2(outstanding.totals.totalOutstanding),
      cashOutstanding: roundNum2(outstanding.totals.cashBalance),
      billOutstanding: roundNum2(outstanding.totals.billBalance),
      todaySales: roundNum2(todaySales),
      todayPayments: roundNum2(todayPayments),
      todayReturns: roundNum2(todayReturns),
    };
  },

  /** Sales/payments/returns/cash-vs-bill split/profit for a selectable period (Today/Week/Month/Year/Custom). */
  async periodSummary(period: PeriodPreset, customFrom?: string, customTo?: string) {
    const { from, to } = resolvePeriodRange(period, customFrom, customTo);

    const [sales, payments, returns, profit] = await Promise.all([
      saleRepository.sumGrandTotalInRange(from, to),
      paymentRepository.sumAmountInRange(from, to),
      returnRepository.sumGrandTotalInRange(from, to),
      reportService.profitReport({ from, to }),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      sales: roundNum2(sales),
      payments: roundNum2(payments),
      returns: roundNum2(returns),
      cashSales: profit.cashSales,
      billSales: profit.billSales,
      grossProfit: profit.grossProfit,
      profitPercent: profit.profitPercent,
      totalInvoices: profit.totalInvoices,
    };
  },

  async monthlySales(year: number) {
    return reportService.monthlySalesReport(year);
  },

  async monthlyCollections(year: number) {
    return reportService.monthlyCollectionsReport(year);
  },

  async recentTransactions(limit = 10) {
    const entries = await prisma.ledgerEntry.findMany({
      orderBy: { sequence: "desc" },
      take: limit,
      include: { customer: true },
    });

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      description: `${LEDGER_TYPE_LABEL[entry.type]}: ${entry.description}`,
      referenceNumber: entry.referenceNumber,
      amount: roundNum2(Number(entry.debit) - Number(entry.credit)),
      date: entry.entryDate,
      customerName: entry.customer.companyName,
    }));
  },

  async outstandingCustomers(limit = 10) {
    const { rows } = await reportService.outstandingReport();
    return rows.slice(0, limit);
  },
};
