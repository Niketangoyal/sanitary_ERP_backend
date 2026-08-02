import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { customerService } from "../services/customer.service";
import { AppError } from "../utils/AppError";

export const customerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await customerService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  recent: asyncHandler(async (_req: Request, res: Response) => {
    const data = await customerService.recent();
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await customerService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await customerService.create(req.body);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await customerService.update(req.params.id, req.body, req.user.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { force, reason } = req.body ?? {};
    await customerService.remove(req.params.id, req.user.userId, !!force, reason);
    res.json({ success: true, message: "Customer deleted" });
  }),
};
