import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { paymentService } from "../services/payment.service";
import { AppError } from "../utils/AppError";

export const paymentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  recent: asyncHandler(async (_req: Request, res: Response) => {
    const data = await paymentService.recent();
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.create(req.body);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await paymentService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Payment deleted" });
  }),
};
