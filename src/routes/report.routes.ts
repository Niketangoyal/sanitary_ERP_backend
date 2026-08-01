import { Router } from "express";
import { reportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth";

export const reportRoutes = Router();

reportRoutes.use(authenticate);

reportRoutes.get("/outstanding", reportController.outstanding);
reportRoutes.get("/sales", reportController.sales);
reportRoutes.get("/returns", reportController.returns);
reportRoutes.get("/payments", reportController.payments);
reportRoutes.get("/item-wise-sales", reportController.itemWiseSales);
reportRoutes.get("/monthly-sales", reportController.monthlySales);
reportRoutes.get("/date-wise-sales", reportController.dateWiseSales);
reportRoutes.get("/:reportKey/pdf", reportController.downloadPdf);
