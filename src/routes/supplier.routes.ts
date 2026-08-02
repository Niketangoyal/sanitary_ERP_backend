import { Router } from "express";
import { supplierController } from "../controllers/supplier.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createSupplierSchema,
  updateSupplierSchema,
  deleteSupplierSchema,
} from "../utils/validators/supplier.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const supplierRoutes = Router();

supplierRoutes.use(authenticate);

supplierRoutes.get("/", supplierController.list);
supplierRoutes.get("/:id", validate({ params: idParamSchema }), supplierController.getById);
supplierRoutes.post("/", validate({ body: createSupplierSchema }), supplierController.create);
supplierRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateSupplierSchema }),
  supplierController.update,
);
supplierRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deleteSupplierSchema }),
  supplierController.remove,
);
