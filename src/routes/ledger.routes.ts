import { Router } from "express";
import { ledgerController } from "../controllers/ledger.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ledgerQuerySchema } from "../utils/validators/ledger.schema";

export const ledgerRoutes = Router();

ledgerRoutes.use(authenticate);

ledgerRoutes.get(
  "/:customerId/pdf",
  validate({ query: ledgerQuerySchema }),
  ledgerController.downloadPdf,
);
ledgerRoutes.get("/:customerId", validate({ query: ledgerQuerySchema }), ledgerController.getStatement);
