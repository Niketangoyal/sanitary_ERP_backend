import { z } from "zod";

export const createPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  date: z.coerce.date(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]),
  accountType: z.enum(["CASH", "BILL"]),
  remarks: z.string().max(500).optional().nullable(),
});

export const listPaymentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  customerId: z.string().optional(),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
