import { Router } from "express";
import { purchaseController } from "../controllers/purchase.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  deletePurchaseSchema,
} from "../utils/validators/purchase.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const purchaseRoutes = Router();

purchaseRoutes.use(authenticate);

purchaseRoutes.get("/", purchaseController.list);
purchaseRoutes.get("/stock-levels", purchaseController.stockLevels);
purchaseRoutes.get("/:id", validate({ params: idParamSchema }), purchaseController.getById);
purchaseRoutes.post("/", validate({ body: createPurchaseSchema }), purchaseController.create);
purchaseRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updatePurchaseSchema }),
  purchaseController.update,
);
purchaseRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deletePurchaseSchema }),
  purchaseController.remove,
);
