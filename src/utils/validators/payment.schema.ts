import { z } from "zod";

// Payments work as a customer-ledger (Khata) credit — always against the
// customer's Cash or Bill account as a whole, never against one invoice.
export const createPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  date: z.coerce.date(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  accountType: z.enum(["CASH", "BILL"]),
  remarks: z.string().max(500).optional().nullable(),
});

// Customer is fixed once a payment is created — editing which customer it
// belongs to isn't a correction, it's a different transaction.
export const updatePaymentSchema = createPaymentSchema.omit({ customerId: true }).partial();

export const deletePaymentSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listPaymentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
