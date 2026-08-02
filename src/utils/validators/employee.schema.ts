import { z } from "zod";

export const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(150),
  mobile: z
    .string()
    .min(10, "Enter a valid mobile number")
    .max(15)
    .regex(/^[0-9+\-\s]+$/, "Enter a valid mobile number"),
  address: z.string().max(500).optional().nullable(),
  email: z.string().email("Enter a valid email").optional().nullable().or(z.literal("")),
  dateOfJoining: z.coerce.date(),
  department: z.string().max(100).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  salaryType: z.enum(["MONTHLY", "DAILY"]).default("MONTHLY"),
  currentSalary: z.coerce.number().positive("Starting salary is required"),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE", "LEFT"]).default("ACTIVE"),
  notes: z.string().max(1000).optional().nullable(),
});

// currentSalary and dateOfJoining are intentionally excluded — salary
// changes must go through a SalaryIncrement so the increment trail (and
// past payroll) stays accurate; joining date anchors the initial increment.
export const updateEmployeeSchema = createEmployeeSchema
  .omit({ currentSalary: true, dateOfJoining: true })
  .partial();

export const listEmployeeQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE", "LEFT"]).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
