import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { advanceService } from "../services/advance.service";
import { AppError } from "../utils/AppError";

export const advanceController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.list(req.params.employeeId);
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.create(req.params.employeeId, req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await advanceService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Advance deleted" });
  }),

  pendingSummary: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.getPendingSummary(req.params.employeeId);
    res.json({ success: true, data });
  }),

  pendingReport: asyncHandler(async (_req: Request, res: Response) => {
    const data = await advanceService.pendingReport();
    res.json({ success: true, data });
  }),

  adjustmentHistory: asyncHandler(async (req: Request, res: Response) => {
    const data = await advanceService.adjustmentHistory(req.query as Record<string, string>);
    res.json({ success: true, data });
  }),
};
