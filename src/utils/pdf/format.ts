import dayjs from "dayjs";

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** pdfkit's Base-14 Helvetica has no glyph for ₹, so PDFs use "Rs." instead of the rupee sign. */
export const formatMoneyPdf = (value: number | string): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `Rs. ${inr.format(Number.isFinite(num) ? num : 0)}`;
};

export const formatDatePdf = (value: Date | string | null | undefined): string =>
  value ? dayjs(value).format("DD-MM-YYYY") : "-";

export const formatDateTimePdf = (value: Date | string | null | undefined): string =>
  value ? dayjs(value).format("DD-MM-YYYY hh:mm A") : "-";
