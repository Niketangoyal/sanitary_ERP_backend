import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { authenticate } from "../middleware/auth";

export const searchRoutes = Router();

searchRoutes.use(authenticate);
searchRoutes.get("/", searchController.search);
