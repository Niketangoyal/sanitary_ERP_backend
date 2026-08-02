import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { reportService } from "../services/report.service";
import { settingsService } from "../services/settings.service";
import { generatePdfBuffer } from "../utils/pdf/printer";
import { buildReportPdfDefinition, type ReportKey } from "../services/pdf/reportPdf";
import { AppError } from "../utils/AppError";

const REPORT_KEYS: ReportKey[] = [
  "outstanding",
  "sales",
  "returns",
  "payments",
  "item-wise-sales",
  "monthly-sales",
  "date-wise-sales",
  "profit",
];

const REPORT_FILENAMES: Record<ReportKey, string> = {
  outstanding: "Outstanding-Report.pdf",
  sales: "Sales-Report.pdf",
  returns: "Returns-Report.pdf",
  payments: "Payments-Report.pdf",
  "item-wise-sales": "Item-Wise-Sales-Report.pdf",
  "monthly-sales": "Monthly-Sales-Report.pdf",
  "date-wise-sales": "Date-Wise-Sales-Report.pdf",
  profit: "Profit-Report.pdf",
};

const parseRange = (query: Record<string, string | undefined>) => ({
  from: query.from ? new Date(query.from) : undefined,
  to: query.to ? new Date(`${query.to}T23:59:59.999`) : undefined,
  customerId: query.customerId || undefined,
  saleType: query.saleType as "CASH" | "BILL" | undefined,
});

export const reportController = {
  outstanding: asyncHandler(async (_req: Request, res: Response) => {
    const data = await reportService.outstandingReport();
    res.json({ success: true, data });
  }),

  sales: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.salesReport(parseRange(req.query as Record<string, string>));
    res.json({ success: true, data });
  }),

  returns: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.returnReport(parseRange(req.query as Record<string, string>));
    res.json({ success: true, data });
  }),

  payments: asyncHandler(async (req: Request, res: Response) => {
    const range = parseRange(req.query as Record<string, string>);
    const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
    const data = await reportService.paymentReport({ ...range, mode });
    res.json({ success: true, data });
  }),

  itemWiseSales: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.itemWiseSalesReport(parseRange(req.query as Record<string, string>));
    res.json({ success: true, data });
  }),

  monthlySales: asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const data = await reportService.monthlySalesReport(year);
    res.json({ success: true, data });
  }),

  dateWiseSales: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.dateWiseSalesReport(parseRange(req.query as Record<string, string>));
    res.json({ success: true, data });
  }),

  profit: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.profitReport(parseRange(req.query as Record<string, string>));
    res.json({ success: true, data });
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const reportKey = req.params.reportKey as ReportKey;
    if (!REPORT_KEYS.includes(reportKey)) {
      throw AppError.notFound(`Unknown report: ${req.params.reportKey}`);
    }

    const range = parseRange(req.query as Record<string, string>);
    const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const settings = await settingsService.getOrCreate();
    const docDefinition = await buildReportPdfDefinition(reportKey, settings, {
      ...range,
      mode,
      year,
    });
    const buffer = await generatePdfBuffer(docDefinition);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${REPORT_FILENAMES[reportKey]}"`);
    res.send(buffer);
  }),
};
