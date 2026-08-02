import { z } from "zod";

export const generateSalarySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  // Admin-chosen amount to deduct from this run against the employee's
  // pending advance balance — full, partial, or 0. Validated against both
  // the pending balance and payable salary in the service layer.
  advanceAdjustment: z.coerce.number().min(0).default(0),
});

export const paySalarySchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  remarks: z.string().max(500).optional().nullable(),
});

// Only the advance deduction and notes are editable, and only before any
// installment has been paid — gross salary, leave days, and leave deduction
// are locked in at generation time (see salary.service.generate).
export const updateSalaryRecordSchema = z.object({
  advanceAdjustment: z.coerce.number().min(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateSalaryPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  remarks: z.string().max(500).optional().nullable(),
});

export const deleteSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listSalaryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  employeeId: z.string().optional(),
  month: z.string().optional(),
  year: z.string().optional(),
  paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL"]).optional(),
});

export type GenerateSalaryInput = z.infer<typeof generateSalarySchema>;
export type PaySalaryInput = z.infer<typeof paySalarySchema>;
export type UpdateSalaryRecordInput = z.infer<typeof updateSalaryRecordSchema>;
export type UpdateSalaryPaymentInput = z.infer<typeof updateSalaryPaymentSchema>;
