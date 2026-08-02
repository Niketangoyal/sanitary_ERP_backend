import { Router } from "express";
import { advanceController } from "../controllers/advance.controller";
import { authenticate } from "../middleware/auth";

// Top-level /advance-reports — cross-employee pending balances + adjustment history.
export const advanceReportRoutes = Router();

advanceReportRoutes.use(authenticate);

advanceReportRoutes.get("/pending", advanceController.pendingReport);
advanceReportRoutes.get("/adjustments", advanceController.adjustmentHistory);
