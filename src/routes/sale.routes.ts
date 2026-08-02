import { Router } from "express";
import { saleController } from "../controllers/sale.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createSaleSchema, updateSaleSchema, deleteSaleSchema } from "../utils/validators/sale.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const saleRoutes = Router();

saleRoutes.use(authenticate);

saleRoutes.get("/", saleController.list);
saleRoutes.get("/recent", saleController.recent);
saleRoutes.get("/:id/pdf", validate({ params: idParamSchema }), saleController.downloadPdf);
saleRoutes.get("/:id", validate({ params: idParamSchema }), saleController.getById);
saleRoutes.post("/", validate({ body: createSaleSchema }), saleController.create);
saleRoutes.put("/:id", validate({ params: idParamSchema, body: updateSaleSchema }), saleController.update);
saleRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deleteSaleSchema }),
  saleController.remove,
);
