import { Router } from "express";
import { paymentController } from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPaymentSchema } from "../utils/validators/payment.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const paymentRoutes = Router();

paymentRoutes.use(authenticate);

paymentRoutes.get("/", paymentController.list);
paymentRoutes.get("/recent", paymentController.recent);
paymentRoutes.get("/:id", validate({ params: idParamSchema }), paymentController.getById);
paymentRoutes.post("/", validate({ body: createPaymentSchema }), paymentController.create);
