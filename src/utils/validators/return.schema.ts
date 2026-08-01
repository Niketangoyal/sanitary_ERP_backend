import { z } from "zod";

export const returnItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be 0 or more"),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
});

export const createReturnSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  returnDate: z.coerce.date(),
  saleId: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  items: z.array(returnItemInputSchema).min(1, "Add at least one item"),
});

export const listReturnQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
