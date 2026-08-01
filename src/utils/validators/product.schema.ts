import { z } from "zod";

export const createProductSchema = z.object({
  itemName: z.string().min(1, "Item name is required").max(200),
  brand: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  specification: z.string().max(500).optional().nullable(),
  unit: z.string().min(1).max(20).default("PCS"),
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0, "Selling price is required"),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
