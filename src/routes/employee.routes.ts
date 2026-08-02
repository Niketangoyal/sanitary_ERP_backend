import { Router } from "express";
import { employeeController } from "../controllers/employee.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "../utils/validators/employee.schema";
import { idParamSchema } from "../utils/validators/customer.schema";
import { salaryIncrementRoutes } from "./salaryIncrement.routes";
import { advanceRoutes } from "./advance.routes";
import { leaveRoutes } from "./leave.routes";
import { salaryRoutes as employeeSalaryRoutes } from "./salary.routes";

export const employeeRoutes = Router();

employeeRoutes.use(authenticate);

employeeRoutes.use("/:employeeId/increments", salaryIncrementRoutes);
employeeRoutes.use("/:employeeId/advances", advanceRoutes);
employeeRoutes.use("/:employeeId/leaves", leaveRoutes);
employeeRoutes.use("/:employeeId/salary", employeeSalaryRoutes);

employeeRoutes.get("/", employeeController.list);
employeeRoutes.get("/:id", validate({ params: idParamSchema }), employeeController.getById);
employeeRoutes.post("/", validate({ body: createEmployeeSchema }), employeeController.create);
employeeRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  employeeController.update,
);
employeeRoutes.delete("/:id", validate({ params: idParamSchema }), employeeController.remove);
