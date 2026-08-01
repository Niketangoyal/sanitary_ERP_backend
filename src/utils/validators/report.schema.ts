import { z } from "zod";

export const dateRangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  customerId: z.string().optional(),
});

export const monthlyReportQuerySchema = z.object({
  year: z.string().optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
