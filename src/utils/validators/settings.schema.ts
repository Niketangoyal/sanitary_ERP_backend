import { z } from "zod";

export const updateSettingsSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional().nullable(),
  gstNumber: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  invoicePrefix: z.string().min(1).max(10).optional(),
  returnPrefix: z.string().min(1).max(10).optional(),
  paymentPrefix: z.string().min(1).max(10).optional(),
  invoiceFooter: z.string().max(1000).optional().nullable(),
  theme: z.enum(["light", "dark"]).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
