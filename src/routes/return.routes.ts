import { Router } from "express";
import { returnController } from "../controllers/return.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createReturnSchema } from "../utils/validators/return.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const returnRoutes = Router();

returnRoutes.use(authenticate);

returnRoutes.get("/", returnController.list);
returnRoutes.get("/recent", returnController.recent);
returnRoutes.get("/:id", validate({ params: idParamSchema }), returnController.getById);
returnRoutes.post("/", validate({ body: createReturnSchema }), returnController.create);
