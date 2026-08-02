import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { saleService } from "../services/sale.service";
import { settingsService } from "../services/settings.service";
import { generatePdfBuffer } from "../utils/pdf/printer";
import { buildInvoicePdfDefinition } from "../services/pdf/invoicePdf";
import { AppError } from "../utils/AppError";

export const saleController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await saleService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  recent: asyncHandler(async (_req: Request, res: Response) => {
    const data = await saleService.recent();
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await saleService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await saleService.create(req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await saleService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await saleService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Invoice deleted" });
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const [sale, settings] = await Promise.all([
      saleService.getById(req.params.id),
      settingsService.getOrCreate(),
    ]);
    const buffer = await generatePdfBuffer(buildInvoicePdfDefinition(sale, settings));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Invoice-${sale.invoiceNumber}.pdf"`);
    res.send(buffer);
  }),
};
