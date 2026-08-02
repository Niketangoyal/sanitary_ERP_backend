import { z } from "zod";

export const createCustomerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  contactPerson: z.string().max(150).optional().nullable(),
  mobile: z
    .string()
    .min(10, "Enter a valid mobile number")
    .max(15)
    .regex(/^[0-9+\-\s]+$/, "Enter a valid mobile number"),
  address: z.string().max(500).optional().nullable(),
  gstNumber: z.string().max(20).optional().nullable(),
  openingCashBalance: z.coerce.number().finite().default(0),
  openingBillBalance: z.coerce.number().finite().default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema
  .omit({ openingCashBalance: true, openingBillBalance: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const deleteCustomerSchema = z.object({
  force: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export const listCustomerQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
