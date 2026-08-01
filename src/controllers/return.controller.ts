import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { returnService } from "../services/return.service";

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

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await returnService.create(req.body);
    res.status(201).json({ success: true, data });
  }),
};
