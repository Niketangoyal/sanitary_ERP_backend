import { Router } from "express";
import { advanceController } from "../controllers/advance.controller";
import { validate } from "../middleware/validate";
import { createAdvanceSchema, updateAdvanceSchema, deleteAdvanceSchema } from "../utils/validators/advance.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const advanceRoutes = Router({ mergeParams: true });

advanceRoutes.get("/", advanceController.list);
advanceRoutes.get("/pending-summary", advanceController.pendingSummary);
advanceRoutes.post("/", validate({ body: createAdvanceSchema }), advanceController.create);
advanceRoutes.get("/:id", validate({ params: idParamSchema }), advanceController.getById);
advanceRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateAdvanceSchema }),
  advanceController.update,
);
advanceRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deleteAdvanceSchema }),
  advanceController.remove,
);
