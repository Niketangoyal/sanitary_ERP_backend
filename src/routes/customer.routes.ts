import { Router } from "express";
import { customerController } from "../controllers/customer.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createCustomerSchema,
  updateCustomerSchema,
  idParamSchema,
} from "../utils/validators/customer.schema";

export const customerRoutes = Router();

customerRoutes.use(authenticate);

customerRoutes.get("/", customerController.list);
customerRoutes.get("/recent", customerController.recent);
customerRoutes.get("/:id", validate({ params: idParamSchema }), customerController.getById);
customerRoutes.post("/", validate({ body: createCustomerSchema }), customerController.create);
customerRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  customerController.update,
);
customerRoutes.delete("/:id", validate({ params: idParamSchema }), customerController.remove);
