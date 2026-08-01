import { Router } from "express";
import { settingsController } from "../controllers/settings.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadLogo } from "../middleware/upload";
import { updateSettingsSchema } from "../utils/validators/settings.schema";

export const settingsRoutes = Router();

settingsRoutes.use(authenticate);

settingsRoutes.get("/", settingsController.get);
settingsRoutes.put("/", validate({ body: updateSettingsSchema }), settingsController.update);
settingsRoutes.post("/logo", uploadLogo.single("logo"), settingsController.uploadLogo);
