import { z } from "zod";

export const ledgerQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
