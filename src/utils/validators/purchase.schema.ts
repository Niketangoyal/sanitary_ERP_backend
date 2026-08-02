import { z } from "zod";

export const createPurchaseSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  purchasePrice: z.coerce.number().positive("Purchase price must be greater than 0"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  purchaseDate: z.coerce.date(),
  supplierId: z.string().min(1).optional().nullable(),
  supplier: z.string().max(150).optional().nullable(),
});

export const updatePurchaseSchema = createPurchaseSchema.omit({ productId: true }).partial();

export const deletePurchaseSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listPurchaseQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  productId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
