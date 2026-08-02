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
  // Required — a return must always trace back to the invoice it's against
  // so item choice and quantity can be capped against what was sold.
  saleId: z.string().min(1, "Original invoice is required"),
  reason: z.string().max(500).optional().nullable(),
  items: z.array(returnItemInputSchema).min(1, "Add at least one item"),
});

// Customer and original invoice are fixed once a return is created — if the
// wrong invoice was picked, delete this return and record a new one rather
// than reattaching an existing return to a different sale.
export const updateReturnSchema = z.object({
  returnDate: z.coerce.date(),
  reason: z.string().max(500).optional().nullable(),
  items: z.array(returnItemInputSchema).min(1, "Add at least one item"),
});

export const deleteReturnSchema = z.object({
  reason: z.string().max(500).optional(),
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
export type UpdateReturnInput = z.infer<typeof updateReturnSchema>;
export type DeleteReturnInput = z.infer<typeof deleteReturnSchema>;
