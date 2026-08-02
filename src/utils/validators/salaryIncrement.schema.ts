import { z } from "zod";

export const createIncrementSchema = z.object({
  newSalary: z.coerce.number().positive("New salary is required"),
  effectiveDate: z.coerce.date(),
  reason: z.string().max(500).optional().nullable(),
});

export type CreateIncrementInput = z.infer<typeof createIncrementSchema>;
