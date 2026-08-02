import { z } from "zod";

const LEAVE_TYPES = ["CASUAL", "SICK", "PAID", "UNPAID", "OTHER"] as const;

export const createLeaveSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    message: "To Date must be on or after From Date",
    path: ["toDate"],
  });

export const updateLeaveSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES).optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((data) => !data.fromDate || !data.toDate || data.toDate >= data.fromDate, {
    message: "To Date must be on or after From Date",
    path: ["toDate"],
  });

export const deleteLeaveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listLeaveQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  employeeId: z.string().optional(),
  month: z.string().optional(),
  year: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type UpdateLeaveInput = z.infer<typeof updateLeaveSchema>;
