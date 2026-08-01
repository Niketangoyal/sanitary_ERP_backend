import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be 0 or more"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
});

export const createSaleSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceDate: z.coerce.date(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(saleItemInputSchema).min(1, "Add at least one item"),
});

export const listSaleQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
