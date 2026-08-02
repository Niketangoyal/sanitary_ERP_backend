import { Router } from "express";
import { salaryController } from "../controllers/salary.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  paySalarySchema,
  updateSalaryRecordSchema,
  updateSalaryPaymentSchema,
  deleteSchema,
} from "../utils/validators/salary.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

// Top-level /salary-records — cross-employee listing + payment + slip.
export const salaryRecordRoutes = Router();

salaryRecordRoutes.use(authenticate);

salaryRecordRoutes.get("/", salaryController.list);
salaryRecordRoutes.get("/:id/pdf", validate({ params: idParamSchema }), salaryController.downloadSlipPdf);
salaryRecordRoutes.get("/:id", validate({ params: idParamSchema }), salaryController.getById);
salaryRecordRoutes.post(
  "/:id/pay",
  validate({ params: idParamSchema, body: paySalarySchema }),
  salaryController.pay,
);
salaryRecordRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateSalaryRecordSchema }),
  salaryController.update,
);
salaryRecordRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deleteSchema }),
  salaryController.remove,
);
salaryRecordRoutes.put(
  "/:id/payments/:paymentId",
  validate({ body: updateSalaryPaymentSchema }),
  salaryController.updatePayment,
);
salaryRecordRoutes.delete(
  "/:id/payments/:paymentId",
  validate({ body: deleteSchema }),
  salaryController.deletePayment,
);
