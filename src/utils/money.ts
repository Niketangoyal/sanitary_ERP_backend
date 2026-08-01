import { Prisma } from "@prisma/client";

export const Decimal = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal.Value;

export const toDecimal = (value: DecimalInput): Prisma.Decimal => new Decimal(value);

export const round2 = (value: Prisma.Decimal): Prisma.Decimal =>
  value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Rounds a plain JS number to 2 decimal places (for pre-aggregated report totals). */
export const roundNum2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Computes a sale/return line item's amounts with server-side precision so
 * the client's displayed totals can never drift from what gets persisted.
 */
export const computeLineItem = (input: {
  quantity: DecimalInput;
  rate: DecimalInput;
  discountPercent?: DecimalInput;
  gstPercent?: DecimalInput;
}) => {
  const quantity = toDecimal(input.quantity);
  const rate = toDecimal(input.rate);
  const discountPercent = toDecimal(input.discountPercent ?? 0);
  const gstPercent = toDecimal(input.gstPercent ?? 0);

  const gross = quantity.mul(rate);
  const discountAmount = round2(gross.mul(discountPercent).div(100));
  const taxable = gross.sub(discountAmount);
  const gstAmount = round2(taxable.mul(gstPercent).div(100));
  const total = round2(taxable.add(gstAmount));

  return { gross: round2(gross), discountAmount, taxable: round2(taxable), gstAmount, total };
};
