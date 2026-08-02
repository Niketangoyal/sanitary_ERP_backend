import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { dashboardService } from "../services/dashboard.service";
import { PeriodPreset } from "../utils/dateRangePresets";

export const dashboardController = {
  summary: asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.summary();
    res.json({ success: true, data });
  }),

  periodSummary: asyncHandler(async (req: Request, res: Response) => {
    const period = (req.query.period as PeriodPreset) || "today";
    const data = await dashboardService.periodSummary(
      period,
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    res.json({ success: true, data });
  }),

  monthlySales: asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const data = await dashboardService.monthlySales(year);
    res.json({ success: true, data });
  }),

  monthlyCollections: asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const data = await dashboardService.monthlyCollections(year);
    res.json({ success: true, data });
  }),

  recentTransactions: asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await dashboardService.recentTransactions(limit);
    res.json({ success: true, data });
  }),

  outstandingCustomers: asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await dashboardService.outstandingCustomers(limit);
    res.json({ success: true, data });
  }),
};
