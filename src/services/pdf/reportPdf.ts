import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Settings } from "@prisma/client";
import { buildLetterhead, buildFooter, pdfStyles } from "../../utils/pdf/common";
import { formatMoneyPdf, formatDatePdf } from "../../utils/pdf/format";
import { PAYMENT_MODE_LABELS, ACCOUNT_TYPE_LABELS } from "../../utils/labels";
import {
  reportService,
  type DateRange,
} from "../report.service";

const baseTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
  hLineColor: () => "#CBD5E1",
  vLineWidth: () => 0,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

const headerRow = (labels: { text: string; alignment?: "left" | "right" }[]): Content[] =>
  labels.map((l) => ({ text: l.text, style: "tableHeader", alignment: l.alignment ?? "left" }));

const buildBase = (
  settings: Settings,
  title: string,
  rangeLabel: string | null,
  tableContent: Content,
  summary?: Content,
): TDocumentDefinitions => ({
  pageOrientation: "landscape",
  styles: { ...pdfStyles, cell: { fontSize: 8.5 } },
  footer: buildFooter(),
  content: [
    buildLetterhead(settings, title),
    ...(rangeLabel ? [{ text: rangeLabel, style: "muted", margin: [0, 0, 0, 12] as [number, number, number, number] }] : []),
    tableContent,
    ...(summary ? [summary] : []),
  ],
});

const summaryBlock = (rows: [string, string][]): Content => ({
  columns: [
    { width: "*", text: "" },
    {
      width: 260,
      table: {
        widths: ["*", "auto"],
        body: rows.map(([label, value], i): Content[] => [
          { text: label, style: i === rows.length - 1 ? "totalLabel" : "cell" },
          { text: value, style: i === rows.length - 1 ? "totalValue" : "cell", alignment: "right" },
        ]),
      },
      layout: "noBorders",
      margin: [0, 10, 0, 0],
    },
  ],
});

export type ReportKey =
  | "outstanding"
  | "sales"
  | "returns"
  | "payments"
  | "item-wise-sales"
  | "monthly-sales"
  | "date-wise-sales"
  | "profit";

export const buildReportPdfDefinition = async (
  reportKey: ReportKey,
  settings: Settings,
  range: DateRange & { mode?: string; year?: number },
): Promise<TDocumentDefinitions> => {
  const rangeLabel =
    range.from && range.to ? `${formatDatePdf(range.from)} to ${formatDatePdf(range.to)}` : null;

  switch (reportKey) {
    case "outstanding": {
      const { rows, totals } = await reportService.outstandingReport();
      return buildBase(
        settings,
        "OUTSTANDING REPORT",
        null,
        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 90, 90, 90],
            body: [
              headerRow([
                { text: "Customer" },
                { text: "Mobile" },
                { text: "Cash Balance", alignment: "right" },
                { text: "Bill Balance", alignment: "right" },
                { text: "Total Outstanding", alignment: "right" },
              ]),
              ...rows.map((r): Content[] => [
                { text: r.companyName, style: "cell" },
                { text: r.mobile, style: "cell" },
                { text: formatMoneyPdf(r.cashBalance), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.billBalance), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.totalOutstanding), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([
          ["Total Cash Outstanding", formatMoneyPdf(totals.cashBalance)],
          ["Total Bill Outstanding", formatMoneyPdf(totals.billBalance)],
          ["Grand Total Outstanding", formatMoneyPdf(totals.totalOutstanding)],
        ]),
      );
    }

    case "sales": {
      const { rows, totals, count } = await reportService.salesReport(range);
      return buildBase(
        settings,
        "SALES REPORT",
        rangeLabel,
        {
          table: {
            headerRows: 1,
            widths: [70, 55, "*", 70, 70, 70, 70],
            body: [
              headerRow([
                { text: "Invoice #" },
                { text: "Date" },
                { text: "Customer" },
                { text: "Subtotal", alignment: "right" },
                { text: "Discount", alignment: "right" },
                { text: "GST", alignment: "right" },
                { text: "Grand Total", alignment: "right" },
              ]),
              ...rows.map((s): Content[] => [
                { text: s.invoiceNumber, style: "cell" },
                { text: formatDatePdf(s.invoiceDate), style: "cell" },
                { text: s.customer.companyName, style: "cell" },
                { text: formatMoneyPdf(Number(s.subtotal)), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(Number(s.discountTotal)), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(Number(s.gstTotal)), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(Number(s.grandTotal)), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([
          ["Invoices", String(count)],
          ["Total GST", formatMoneyPdf(totals.gstTotal)],
          ["Grand Total", formatMoneyPdf(totals.grandTotal)],
        ]),
      );
    }

    case "returns": {
      const { rows, totals, count } = await reportService.returnReport(range);
      return buildBase(
        settings,
        "RETURNS REPORT",
        rangeLabel,
        {
          table: {
            headerRows: 1,
            widths: [70, 55, "*", "*", 70, 70],
            body: [
              headerRow([
                { text: "Return #" },
                { text: "Date" },
                { text: "Customer" },
                { text: "Reason" },
                { text: "GST", alignment: "right" },
                { text: "Amount", alignment: "right" },
              ]),
              ...rows.map((r): Content[] => [
                { text: r.returnNumber, style: "cell" },
                { text: formatDatePdf(r.returnDate), style: "cell" },
                { text: r.customer.companyName, style: "cell" },
                { text: r.reason ?? "-", style: "cell" },
                { text: formatMoneyPdf(Number(r.gstTotal)), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(Number(r.grandTotal)), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([
          ["Returns", String(count)],
          ["Total Amount", formatMoneyPdf(totals.grandTotal)],
        ]),
      );
    }

    case "payments": {
      const { rows, totals, count } = await reportService.paymentReport(range);
      return buildBase(
        settings,
        "PAYMENTS REPORT",
        rangeLabel,
        {
          table: {
            headerRows: 1,
            widths: [70, 55, "*", 70, 80, 70],
            body: [
              headerRow([
                { text: "Payment #" },
                { text: "Date" },
                { text: "Customer" },
                { text: "Mode" },
                { text: "Account" },
                { text: "Amount", alignment: "right" },
              ]),
              ...rows.map((p): Content[] => [
                { text: p.paymentNumber, style: "cell" },
                { text: formatDatePdf(p.date), style: "cell" },
                { text: p.customer.companyName, style: "cell" },
                { text: PAYMENT_MODE_LABELS[p.mode], style: "cell" },
                { text: ACCOUNT_TYPE_LABELS[p.accountType], style: "cell" },
                { text: formatMoneyPdf(Number(p.amount)), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([
          ["Payments", String(count)],
          ["Total Collected", formatMoneyPdf(totals)],
        ]),
      );
    }

    case "item-wise-sales": {
      const { rows, totals } = await reportService.itemWiseSalesReport(range);
      return buildBase(
        settings,
        "ITEM WISE SALES REPORT",
        rangeLabel,
        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 90, 70, 80, 90],
            body: [
              headerRow([
                { text: "Item Name" },
                { text: "Brand" },
                { text: "Category" },
                { text: "Qty Sold", alignment: "right" },
                { text: "GST", alignment: "right" },
                { text: "Total Sales", alignment: "right" },
              ]),
              ...rows.map((r): Content[] => [
                { text: r.itemName, style: "cell" },
                { text: r.brand ?? "-", style: "cell" },
                { text: r.category ?? "-", style: "cell" },
                { text: String(r.quantitySold), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.totalGst), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.totalSales), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([
          ["Total Quantity Sold", String(totals.quantitySold)],
          ["Total Sales", formatMoneyPdf(totals.totalSales)],
        ]),
      );
    }

    case "monthly-sales": {
      const year = range.year ?? new Date().getFullYear();
      const rows = await reportService.monthlySalesReport(year);
      const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
      return buildBase(
        settings,
        `MONTHLY SALES REPORT - ${year}`,
        null,
        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 120],
            body: [
              headerRow([
                { text: "Month" },
                { text: "Invoices", alignment: "right" },
                { text: "Total Sales", alignment: "right" },
              ]),
              ...rows.map((r): Content[] => [
                { text: r.label, style: "cell" },
                { text: String(r.count), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.total), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([["Grand Total", formatMoneyPdf(grandTotal)]]),
      );
    }

    case "date-wise-sales": {
      const rows = await reportService.dateWiseSalesReport(range);
      const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
      return buildBase(
        settings,
        "DATE WISE SALES REPORT",
        rangeLabel,
        {
          table: {
            headerRows: 1,
            widths: ["*", 90, 120],
            body: [
              headerRow([
                { text: "Date" },
                { text: "Invoices", alignment: "right" },
                { text: "Total Sales", alignment: "right" },
              ]),
              ...rows.map((r): Content[] => [
                { text: formatDatePdf(r.date), style: "cell" },
                { text: String(r.count), style: "cell", alignment: "right" },
                { text: formatMoneyPdf(r.total), style: "cell", alignment: "right" },
              ]),
            ],
          },
          layout: baseTableLayout,
        },
        summaryBlock([["Grand Total", formatMoneyPdf(grandTotal)]]),
      );
    }

    case "profit": {
      const p = await reportService.profitReport(range);
      return buildBase(
        settings,
        "PROFIT REPORT",
        rangeLabel,
        summaryBlock([
          ["Total Sales", formatMoneyPdf(p.totalSales)],
          ["Total Purchase Cost (COGS)", formatMoneyPdf(p.totalCOGS)],
          ["Cash (Kacha) Sales", formatMoneyPdf(p.cashSales)],
          ["Bill (Pakka) Sales", formatMoneyPdf(p.billSales)],
          ["Total Invoices", String(p.totalInvoices)],
          ["Total Products Sold", String(p.totalProductsSold)],
          ["Paid Amount", formatMoneyPdf(p.paidAmount)],
          ["Outstanding Amount", formatMoneyPdf(p.outstandingAmount)],
          ["Profit %", `${p.profitPercent}%`],
          ["Gross Profit", formatMoneyPdf(p.grossProfit)],
        ]),
      );
    }

    default:
      throw new Error(`Unknown report: ${reportKey}`);
  }
};
