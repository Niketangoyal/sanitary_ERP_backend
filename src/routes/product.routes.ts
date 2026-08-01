import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProductSchema, updateProductSchema } from "../utils/validators/product.schema";
import { idParamSchema } from "../utils/validators/customer.schema";

export const productRoutes = Router();

productRoutes.use(authenticate);

productRoutes.get("/", productController.list);
productRoutes.get("/recent", productController.recent);
productRoutes.get("/categories", productController.categories);
productRoutes.get("/:id", validate({ params: idParamSchema }), productController.getById);
productRoutes.post("/", validate({ body: createProductSchema }), productController.create);
productRoutes.put(
  "/:id",
  validate({ params: idParamSchema, body: updateProductSchema }),
  productController.update,
);
productRoutes.delete("/:id", validate({ params: idParamSchema }), productController.remove);
