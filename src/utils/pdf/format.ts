import dayjs from "dayjs";

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * pdfkit's Base-14 Helvetica has no glyph for ₹, so PDFs use "Rs." instead
 * of the rupee sign. Accepts Prisma.Decimal too (not just number | string):
 * Decimal is an object at runtime, and `Number(decimal)` correctly coerces
 * via its `valueOf()`, whereas a naive `typeof value === "string"` check
 * would silently fall through and render every amount as Rs. 0.00.
 */
export const formatMoneyPdf = (value: unknown): string => {
  const num = Number(value);
  return `Rs. ${inr.format(Number.isFinite(num) ? num : 0)}`;
};

export const formatDatePdf = (value: Date | string | null | undefined): string =>
  value ? dayjs(value).format("DD-MM-YYYY") : "-";

export const formatDateTimePdf = (value: Date | string | null | undefined): string =>
  value ? dayjs(value).format("DD-MM-YYYY hh:mm A") : "-";
