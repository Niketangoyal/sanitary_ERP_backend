import dayjs from "dayjs";
import { prisma } from "../config/prisma";
import { customerRepository } from "../repositories/customer.repository";
import { ledgerRepository } from "../repositories/ledger.repository";
import { saleRepository } from "../repositories/sale.repository";
import { returnRepository } from "../repositories/return.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { roundNum2 } from "../utils/money";

export interface DateRange {
  from?: Date;
  to?: Date;
  customerId?: string;
  saleType?: "CASH" | "BILL";
}

export const reportService = {
  async outstandingReport() {
    const customers = await customerRepository.findMany({ where: { isActive: true } });
    const balances = await ledgerRepository.getCurrentBalancesForMany(customers.map((c) => c.id));

    const rows = customers
      .map((customer) => {
        const balance = balances.get(customer.id) ?? { cashBalance: 0, billBalance: 0 };
        return {
          customerId: customer.id,
          companyName: customer.companyName,
          mobile: customer.mobile,
          cashBalance: balance.cashBalance,
          billBalance: balance.billBalance,
          totalOutstanding: roundNum2(balance.cashBalance + balance.billBalance),
        };
      })
      .filter((row) => row.totalOutstanding !== 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const totals = rows.reduce(
      (acc, row) => {
        acc.cashBalance += row.cashBalance;
        acc.billBalance += row.billBalance;
        acc.totalOutstanding += row.totalOutstanding;
        return acc;
      },
      { cashBalance: 0, billBalance: 0, totalOutstanding: 0 },
    );

    return { rows, totals };
  },

  async salesReport(range: DateRange) {
    const sales = await saleRepository.findMany({
      where: {
        ...(range.customerId ? { customerId: range.customerId } : {}),
        ...(range.saleType ? { saleType: range.saleType } : {}),
        invoiceDate: { gte: range.from, lte: range.to },
      },
      orderBy: { invoiceDate: "asc" },
    });

    const totals = sales.reduce(
      (acc, s) => {
        acc.subtotal += Number(s.subtotal);
        acc.discountTotal += Number(s.discountTotal);
        acc.gstTotal += Number(s.gstTotal);
        acc.grandTotal += Number(s.grandTotal);
        return acc;
      },
      { subtotal: 0, discountTotal: 0, gstTotal: 0, grandTotal: 0 },
    );

    return { rows: sales, totals, count: sales.length };
  },

  async returnReport(range: DateRange) {
    const returns = await returnRepository.findMany({
      where: {
        ...(range.customerId ? { customerId: range.customerId } : {}),
        returnDate: { gte: range.from, lte: range.to },
      },
      orderBy: { returnDate: "asc" },
    });

    const totals = returns.reduce(
      (acc, r) => {
        acc.subtotal += Number(r.subtotal);
        acc.gstTotal += Number(r.gstTotal);
        acc.grandTotal += Number(r.grandTotal);
        return acc;
      },
      { subtotal: 0, gstTotal: 0, grandTotal: 0 },
    );

    return { rows: returns, totals, count: returns.length };
  },

  async paymentReport(range: DateRange & { mode?: string }) {
    const payments = await paymentRepository.findMany({
      where: {
        ...(range.customerId ? { customerId: range.customerId } : {}),
        ...(range.mode ? { mode: range.mode as never } : {}),
        date: { gte: range.from, lte: range.to },
      },
      orderBy: { date: "asc" },
    });

    const totals = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    return { rows: payments, totals: roundNum2(totals), count: payments.length };
  },

  async itemWiseSalesReport(range: DateRange) {
    const grouped = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { invoiceDate: { gte: range.from, lte: range.to }, deletedAt: null } },
      _sum: { quantity: true, total: true, gstAmount: true },
    });

    const productIds = grouped.map((g) => g.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const rows = grouped
      .map((g) => {
        const product = productMap.get(g.productId);
        return {
          productId: g.productId,
          itemName: product?.itemName ?? "Unknown Product",
          brand: product?.brand ?? null,
          category: product?.category ?? null,
          quantitySold: Number(g._sum.quantity ?? 0),
          totalSales: Number(g._sum.total ?? 0),
          totalGst: Number(g._sum.gstAmount ?? 0),
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const totals = rows.reduce(
      (acc, r) => {
        acc.quantitySold += r.quantitySold;
        acc.totalSales += r.totalSales;
        return acc;
      },
      { quantitySold: 0, totalSales: 0 },
    );

    return { rows, totals };
  },

  async monthlySalesReport(year: number) {
    const from = dayjs(`${year}-01-01`).startOf("year").toDate();
    const to = dayjs(`${year}-12-31`).endOf("year").toDate();

    const sales = await saleRepository.findMany({
      where: { invoiceDate: { gte: from, lte: to } },
    });

    const buckets = new Map<string, { total: number; count: number }>();
    for (let m = 0; m < 12; m++) {
      buckets.set(dayjs(`${year}-01-01`).month(m).format("YYYY-MM"), { total: 0, count: 0 });
    }

    for (const sale of sales) {
      const key = dayjs(sale.invoiceDate).format("YYYY-MM");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.total = roundNum2(bucket.total + Number(sale.grandTotal));
        bucket.count += 1;
      }
    }

    return Array.from(buckets.entries()).map(([month, data]) => ({
      month,
      label: dayjs(`${month}-01`).format("MMM YYYY"),
      total: data.total,
      count: data.count,
    }));
  },

  async monthlyCollectionsReport(year: number) {
    const from = dayjs(`${year}-01-01`).startOf("year").toDate();
    const to = dayjs(`${year}-12-31`).endOf("year").toDate();

    const payments = await paymentRepository.findMany({
      where: { date: { gte: from, lte: to } },
    });

    const buckets = new Map<string, { total: number; count: number }>();
    for (let m = 0; m < 12; m++) {
      buckets.set(dayjs(`${year}-01-01`).month(m).format("YYYY-MM"), { total: 0, count: 0 });
    }

    for (const payment of payments) {
      const key = dayjs(payment.date).format("YYYY-MM");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.total = roundNum2(bucket.total + Number(payment.amount));
        bucket.count += 1;
      }
    }

    return Array.from(buckets.entries()).map(([month, data]) => ({
      month,
      label: dayjs(`${month}-01`).format("MMM YYYY"),
      total: data.total,
      count: data.count,
    }));
  },

  /** Profit = Sales − COGS, where COGS is the FIFO cost recorded on each sale item at sale time. */
  async profitReport(range: DateRange) {
    const [sales, itemAgg] = await Promise.all([
      saleRepository.findMany({
        where: { invoiceDate: { gte: range.from, lte: range.to } },
      }),
      prisma.saleItem.aggregate({
        where: { sale: { invoiceDate: { gte: range.from, lte: range.to }, deletedAt: null } },
        _sum: { costOfGoods: true, quantity: true },
      }),
    ]);

    const totalSales = roundNum2(sales.reduce((sum, s) => sum + Number(s.grandTotal), 0));
    const totalCOGS = roundNum2(Number(itemAgg._sum.costOfGoods ?? 0));
    const grossProfit = roundNum2(totalSales - totalCOGS);
    const cashSales = roundNum2(
      sales.filter((s) => s.saleType === "CASH").reduce((sum, s) => sum + Number(s.grandTotal), 0),
    );
    const billSales = roundNum2(
      sales.filter((s) => s.saleType === "BILL").reduce((sum, s) => sum + Number(s.grandTotal), 0),
    );
    const paidAmount = roundNum2(sales.reduce((sum, s) => sum + Number(s.amountPaid), 0));
    const outstandingAmount = roundNum2(sales.reduce((sum, s) => sum + Number(s.balanceDue), 0));

    return {
      totalSales,
      totalCOGS,
      grossProfit,
      profitPercent: totalSales > 0 ? roundNum2((grossProfit / totalSales) * 100) : 0,
      totalInvoices: sales.length,
      totalProductsSold: Number(itemAgg._sum.quantity ?? 0),
      cashSales,
      billSales,
      paidAmount,
      outstandingAmount,
    };
  },

  async dateWiseSalesReport(range: DateRange) {
    const sales = await saleRepository.findMany({
      where: { invoiceDate: { gte: range.from, lte: range.to } },
      orderBy: { invoiceDate: "asc" },
    });

    const buckets = new Map<string, { total: number; count: number }>();
    for (const sale of sales) {
      const key = dayjs(sale.invoiceDate).format("YYYY-MM-DD");
      const bucket = buckets.get(key) ?? { total: 0, count: 0 };
      bucket.total = roundNum2(bucket.total + Number(sale.grandTotal));
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, total: data.total, count: data.count }));
  },
};
