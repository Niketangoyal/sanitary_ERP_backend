import { Router } from "express";
import { leaveController } from "../controllers/leave.controller";
import { validate } from "../middleware/validate";
import { createLeaveSchema } from "../utils/validators/leave.schema";

// Nested under /employees/:employeeId/leaves
export const leaveRoutes = Router({ mergeParams: true });

leaveRoutes.get("/", leaveController.listForEmployee);
leaveRoutes.post("/", validate({ body: createLeaveSchema }), leaveController.create);
