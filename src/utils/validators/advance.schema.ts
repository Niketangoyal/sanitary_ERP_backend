import { z } from "zod";

export const createAdvanceSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number().positive("Advance amount must be greater than 0"),
  reason: z.string().max(500).optional().nullable(),
});

export const updateAdvanceSchema = createAdvanceSchema.partial();

export const deleteAdvanceSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateAdvanceInput = z.infer<typeof createAdvanceSchema>;
export type UpdateAdvanceInput = z.infer<typeof updateAdvanceSchema>;
