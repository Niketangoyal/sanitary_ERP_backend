import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth";

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);

dashboardRoutes.get("/summary", dashboardController.summary);
dashboardRoutes.get("/monthly-sales", dashboardController.monthlySales);
dashboardRoutes.get("/monthly-collections", dashboardController.monthlyCollections);
dashboardRoutes.get("/recent-transactions", dashboardController.recentTransactions);
dashboardRoutes.get("/outstanding-customers", dashboardController.outstandingCustomers);
