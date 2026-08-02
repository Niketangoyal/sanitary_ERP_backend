import { Router } from "express";
import { salaryIncrementController } from "../controllers/salaryIncrement.controller";
import { validate } from "../middleware/validate";
import { createIncrementSchema } from "../utils/validators/salaryIncrement.schema";

export const salaryIncrementRoutes = Router({ mergeParams: true });

salaryIncrementRoutes.get("/", salaryIncrementController.list);
salaryIncrementRoutes.post("/", validate({ body: createIncrementSchema }), salaryIncrementController.create);
