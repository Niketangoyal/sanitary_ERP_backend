import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { leaveService } from "../services/leave.service";
import { settingsService } from "../services/settings.service";
import { generatePdfBuffer } from "../utils/pdf/printer";
import { buildLeaveReportPdfDefinition } from "../services/pdf/leavePdf";
import { buildCsv } from "../utils/csv";
import { formatDatePdf } from "../utils/pdf/format";
import { AppError } from "../utils/AppError";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  PAID: "Paid",
  UNPAID: "Unpaid",
  OTHER: "Other",
};

const rangeLabelFor = (query: Record<string, string>): string | null => {
  if (query.month && query.year) return `${query.month}/${query.year}`;
  if (query.from && query.to) return `${query.from} to ${query.to}`;
  return null;
};

export const leaveController = {
  listForEmployee: asyncHandler(async (req: Request, res: Response) => {
    const data = await leaveService.listForEmployee(req.params.employeeId);
    res.json({ success: true, data });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await leaveService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await leaveService.create(req.params.employeeId, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await leaveService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await leaveService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await leaveService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Leave record deleted" });
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;
    const [rows, settings] = await Promise.all([leaveService.listAll(query), settingsService.getOrCreate()]);
    const buffer = await generatePdfBuffer(
      buildLeaveReportPdfDefinition(rows, settings, rangeLabelFor(query)),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Leave-Report.pdf"');
    res.send(buffer);
  }),

  downloadCsv: asyncHandler(async (req: Request, res: Response) => {
    const rows = await leaveService.listAll(req.query as Record<string, string>);
    const csv = buildCsv(
      ["Employee", "Employee Code", "Leave Type", "From", "To", "Total Days", "Reason"],
      rows.map((r) => [
        r.employee.fullName,
        r.employee.employeeCode,
        LEAVE_TYPE_LABEL[r.leaveType],
        formatDatePdf(r.fromDate),
        formatDatePdf(r.toDate),
        String(r.totalDays),
        r.reason ?? "",
      ]),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="Leave-Report.csv"');
    res.send(csv);
  }),
};
