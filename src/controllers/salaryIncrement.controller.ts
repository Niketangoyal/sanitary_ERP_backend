import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { salaryIncrementService } from "../services/salaryIncrement.service";

export const salaryIncrementController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await salaryIncrementService.list(req.params.employeeId);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await salaryIncrementService.create(req.params.employeeId, req.body);
    res.status(201).json({ success: true, data });
  }),
};
