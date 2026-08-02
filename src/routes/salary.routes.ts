import { Router } from "express";
import { salaryController } from "../controllers/salary.controller";
import { validate } from "../middleware/validate";
import { generateSalarySchema } from "../utils/validators/salary.schema";

// Nested under /employees/:employeeId/salary
export const salaryRoutes = Router({ mergeParams: true });

salaryRoutes.get("/", salaryController.listForEmployee);
salaryRoutes.post("/generate", validate({ body: generateSalarySchema }), salaryController.generate);
