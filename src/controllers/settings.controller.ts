import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { settingsService } from "../services/settings.service";
import { AppError } from "../utils/AppError";

export const settingsController = {
  get: asyncHandler(async (_req: Request, res: Response) => {
    const data = await settingsService.getOrCreate();
    res.json({ success: true, data });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await settingsService.update(req.body);
    res.json({ success: true, data });
  }),

  uploadLogo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest("No file uploaded");
    const logoUrl = `/uploads/${req.file.filename}`;
    const data = await settingsService.update({ logoUrl });
    res.json({ success: true, data });
  }),
};
