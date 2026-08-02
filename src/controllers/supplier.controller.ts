import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { supplierService } from "../services/supplier.service";
import { AppError } from "../utils/AppError";

export const supplierController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await supplierService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await supplierService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await supplierService.create(req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await supplierService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await supplierService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Supplier deleted" });
  }),
};
