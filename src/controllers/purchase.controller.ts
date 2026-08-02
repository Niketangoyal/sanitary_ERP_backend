import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { purchaseService } from "../services/purchase.service";
import { AppError } from "../utils/AppError";

export const purchaseController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await purchaseService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  stockLevels: asyncHandler(async (_req: Request, res: Response) => {
    const map = await purchaseService.stockLevels();
    res.json({ success: true, data: Object.fromEntries(map) });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await purchaseService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await purchaseService.create(req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await purchaseService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await purchaseService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Purchase deleted" });
  }),
};
