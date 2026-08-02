import { Router } from "express";
import { leaveController } from "../controllers/leave.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateLeaveSchema, deleteLeaveSchema } from "../utils/validators/leave.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

// Top-level /leaves — cross-employee listing (for reports) + view/edit/delete by id.
export const leaveRecordRoutes = Router();

leaveRecordRoutes.use(authenticate);

leaveRecordRoutes.get("/", leaveController.list);
leaveRecordRoutes.get("/pdf", leaveController.downloadPdf);
leaveRecordRoutes.get("/csv", leaveController.downloadCsv);
leaveRecordRoutes.get("/:id", validate({ params: idParamSchema }), leaveController.getById);
leaveRecordRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateLeaveSchema }),
  leaveController.update,
);
leaveRecordRoutes.delete(
  "/:id",
  validate({ params: idParamSchema, body: deleteLeaveSchema }),
  leaveController.remove,
);
