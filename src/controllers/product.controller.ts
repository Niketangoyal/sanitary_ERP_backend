import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { productService } from "../services/product.service";
import { AppError } from "../utils/AppError";

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }),

  recent: asyncHandler(async (_req: Request, res: Response) => {
    const data = await productService.recent();
    res.json({ success: true, data });
  }),

  categories: asyncHandler(async (_req: Request, res: Response) => {
    const data = await productService.categories();
    res.json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await productService.getById(req.params.id);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await productService.create(req.body, req.user?.userId);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await productService.update(req.params.id, req.body, req.user?.userId);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await productService.remove(req.params.id, req.user.userId, req.body?.reason);
    res.json({ success: true, message: "Product deleted" });
  }),
};
