import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be 0 or more"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
});

export const createSaleSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required"),
    invoiceDate: z.coerce.date(),
    saleType: z.enum(["CASH", "BILL"], { required_error: "Sale type is required" }),
    paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"], {
      required_error: "Payment status is required",
    }),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).optional(),
    amountPaid: z.coerce.number().min(0).default(0),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(saleItemInputSchema).min(1, "Add at least one item"),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === "UNPAID" && data.amountPaid > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountPaid"],
        message: "Amount paid must be 0 when payment status is Unpaid",
      });
    }
    if (data.paymentStatus !== "UNPAID") {
      if (data.amountPaid <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amountPaid"],
          message: "Amount paid is required for Paid / Partially Paid invoices",
        });
      }
      if (!data.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentMethod"],
          message: "Payment method is required when money is received",
        });
      }
    }
  });

// Customer is fixed once an invoice is created — editing which customer it
// belongs to isn't a correction, it's a different transaction.
export const updateSaleSchema = z
  .object({
    invoiceDate: z.coerce.date(),
    saleType: z.enum(["CASH", "BILL"], { required_error: "Sale type is required" }),
    paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"], {
      required_error: "Payment status is required",
    }),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).optional(),
    amountPaid: z.coerce.number().min(0).default(0),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(saleItemInputSchema).min(1, "Add at least one item"),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === "UNPAID" && data.amountPaid > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountPaid"],
        message: "Amount paid must be 0 when payment status is Unpaid",
      });
    }
    if (data.paymentStatus !== "UNPAID") {
      if (data.amountPaid <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amountPaid"],
          message: "Amount paid is required for Paid / Partially Paid invoices",
        });
      }
      if (!data.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentMethod"],
          message: "Payment method is required when money is received",
        });
      }
    }
  });

export const deleteSaleSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listSaleQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  customerId: z.string().optional(),
  saleType: z.enum(["CASH", "BILL"]).optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
