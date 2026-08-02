import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { returnService } from "../services/return.service";
import { AppError } from "../utils/AppError";

export const returnController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await returnService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  recent: asyncHandler(async (_req: Request, res: Response) => {
    const data = await returnService.recent();
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await returnService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  eligibleItems: asyncHandler(async (req: Request, res: Response) => {
    const data = await returnService.getEligibleItems(
      req.params.saleId,
      typeof req.query.excludeReturnId === "string" ? req.query.excludeReturnId : undefined,
    );
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await returnService.create(req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await returnService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await returnService.delete(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, data });
  }),
};
