import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { salaryService } from "../services/salary.service";
import { settingsService } from "../services/settings.service";
import { advanceService } from "../services/advance.service";
import { generatePdfBuffer } from "../utils/pdf/printer";
import { buildSalarySlipPdfDefinition } from "../services/pdf/salarySlipPdf";
import { AppError } from "../utils/AppError";

export const salaryController = {
  listForEmployee: asyncHandler(async (req: Request, res: Response) => {
    const data = await salaryService.listForEmployee(req.params.employeeId);
    res.json({ success: true, data });
  }),

  generate: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await salaryService.generate(req.params.employeeId, req.body, req.user.userId);
    res.status(201).json({ success: true, data });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await salaryService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await salaryService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  pay: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await salaryService.pay(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await salaryService.update(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await salaryService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Salary record deleted" });
  }),

  updatePayment: asyncHandler(async (req: Request, res: Response) => {
    const data = await salaryService.updatePayment(req.params.paymentId, req.body);
    res.json({ success: true, data });
  }),

  deletePayment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await salaryService.deletePayment(req.params.paymentId, req.user.userId, req.body?.reason);
    res.json({ success: true, data });
  }),

  downloadSlipPdf: asyncHandler(async (req: Request, res: Response) => {
    const [record, settings] = await Promise.all([
      salaryService.getById(req.params.id),
      settingsService.getOrCreate(),
    ]);
    const { totalPending } = await advanceService.getPendingSummary(record.employeeId);
    const buffer = await generatePdfBuffer(
      buildSalarySlipPdfDefinition(record, settings, totalPending),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Salary-Slip-${record.salaryNumber.replace(/\//g, "-")}.pdf"`,
    );
    res.send(buffer);
  }),
};
