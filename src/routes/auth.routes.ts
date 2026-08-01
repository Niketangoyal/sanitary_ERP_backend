import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { loginSchema } from "../utils/validators/auth.schema";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginSchema }), authController.login);
authRoutes.get("/me", authenticate, authController.me);
authRoutes.post("/logout", authenticate, authController.logout);
