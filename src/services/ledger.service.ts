import { Prisma, LedgerAccountType, LedgerEntryType } from "@prisma/client";
import { ledgerRepository } from "../repositories/ledger.repository";
import { customerRepository } from "../repositories/customer.repository";
import { AppError } from "../utils/AppError";
import { toDecimal, round2 } from "../utils/money";

export interface PostLedgerEntryInput {
  customerId: string;
  entryDate: Date;
  type: LedgerEntryType;
  accountType: LedgerAccountType;
  description: string;
  referenceNumber?: string | null;
  debit?: Prisma.Decimal.Value;
  credit?: Prisma.Decimal.Value;
  saleId?: string | null;
  returnId?: string | null;
  paymentId?: string | null;
}

/**
 * Central ledger posting engine. Every module that touches customer
 * balances (customers, sales, returns, payments) MUST post through here so
 * running balances stay consistent — never write to ledger_entries
 * directly. Must always be called with the caller's transaction client so
 * the posting is atomic with the business record it originates from.
 */
export const ledgerService = {
  async postEntry(tx: Prisma.TransactionClient, input: PostLedgerEntryInput) {
    const debit = round2(toDecimal(input.debit ?? 0));
    const credit = round2(toDecimal(input.credit ?? 0));

    const last = await ledgerRepository.findLastEntry(tx, input.customerId);
    const prevCash = last ? toDecimal(last.cashBalanceAfter) : toDecimal(0);
    const prevBill = last ? toDecimal(last.billBalanceAfter) : toDecimal(0);

    const delta = debit.sub(credit);
    const cashBalanceAfter = input.accountType === "CASH" ? round2(prevCash.add(delta)) : round2(prevCash);
    const billBalanceAfter = input.accountType === "BILL" ? round2(prevBill.add(delta)) : round2(prevBill);

    return ledgerRepository.create(tx, {
      customerId: input.customerId,
      entryDate: input.entryDate,
      type: input.type,
      accountType: input.accountType,
      description: input.description,
      referenceNumber: input.referenceNumber ?? null,
      debit,
      credit,
      cashBalanceAfter,
      billBalanceAfter,
      saleId: input.saleId ?? null,
      returnId: input.returnId ?? null,
      paymentId: input.paymentId ?? null,
    });
  },

  /** Posts a customer's two opening balance rows (Cash + Bill accounts). */
  async postOpeningBalances(
    tx: Prisma.TransactionClient,
    params: { customerId: string; openingCashBalance: Prisma.Decimal.Value; openingBillBalance: Prisma.Decimal.Value; date: Date },
  ) {
    const cash = toDecimal(params.openingCashBalance);
    const bill = toDecimal(params.openingBillBalance);

    await ledgerService.postEntry(tx, {
      customerId: params.customerId,
      entryDate: params.date,
      type: "OPENING",
      accountType: "CASH",
      description: "Opening Balance - Cash Account",
      debit: cash.isNegative() ? 0 : cash,
      credit: cash.isNegative() ? cash.abs() : 0,
    });

    await ledgerService.postEntry(tx, {
      customerId: params.customerId,
      entryDate: params.date,
      type: "OPENING",
      accountType: "BILL",
      description: "Opening Balance - Bill Account",
      debit: bill.isNegative() ? 0 : bill,
      credit: bill.isNegative() ? bill.abs() : 0,
    });
  },

  /**
   * Replays a customer's full ledger in `sequence` order and rewrites
   * cashBalanceAfter/billBalanceAfter on every row. Must be called after
   * anything mutates a past entry's debit/credit or removes a row —
   * editing/deleting a Sale, Return, or Payment always ends with this so
   * every later entry's running balance stays correct.
   */
  async recomputeCustomerBalances(tx: Prisma.TransactionClient, customerId: string) {
    const entries = await tx.ledgerEntry.findMany({
      where: { customerId },
      orderBy: { sequence: "asc" },
    });

    let cash = toDecimal(0);
    let bill = toDecimal(0);

    for (const entry of entries) {
      const delta = toDecimal(entry.debit).sub(toDecimal(entry.credit));
      if (entry.accountType === "CASH") cash = round2(cash.add(delta));
      else bill = round2(bill.add(delta));

      if (!toDecimal(entry.cashBalanceAfter).equals(cash) || !toDecimal(entry.billBalanceAfter).equals(bill)) {
        await tx.ledgerEntry.update({
          where: { id: entry.id },
          data: { cashBalanceAfter: cash, billBalanceAfter: bill },
        });
      }
    }
  },

  /**
   * Deletes every ledger entry tied to a given sale/return/payment and
   * recomputes running balances for the affected customer. Used to reverse
   * a document's ledger effect before re-posting new values (edit) or
   * permanently (delete).
   */
  async reverseEntriesFor(
    tx: Prisma.TransactionClient,
    where: { saleId: string } | { returnId: string } | { paymentId: string },
  ) {
    const entries = await tx.ledgerEntry.findMany({ where });
    if (entries.length === 0) return;

    const customerId = entries[0].customerId;
    await tx.ledgerEntry.deleteMany({ where });
    await ledgerService.recomputeCustomerBalances(tx, customerId);
  },

  /** Full statement for a customer, optionally scoped to a date range, for the Ledger page/PDF/reports. */
  async getStatement(customerId: string, range: { from?: Date; to?: Date }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw AppError.notFound("Customer not found");

    const entries = await ledgerRepository.findByCustomer(customerId, range);

    let openingCashBalance = 0;
    let openingBillBalance = 0;
    if (range.from) {
      const before = await ledgerRepository.findLastBefore(customerId, range.from);
      openingCashBalance = before ? Number(before.cashBalanceAfter) : 0;
      openingBillBalance = before ? Number(before.billBalanceAfter) : 0;
    }

    const last = entries[entries.length - 1];
    const closingCashBalance = last ? Number(last.cashBalanceAfter) : openingCashBalance;
    const closingBillBalance = last ? Number(last.billBalanceAfter) : openingBillBalance;

    return {
      customer,
      openingCashBalance,
      openingBillBalance,
      entries,
      closingCashBalance,
      closingBillBalance,
      closingTotalBalance: round2(toDecimal(closingCashBalance).add(closingBillBalance)).toNumber(),
    };
  },
};
