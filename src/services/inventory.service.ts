import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { toDecimal, round2 } from "../utils/money";

export interface ConsumptionPlanEntry {
  batchId: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
}

export interface ConsumptionResult {
  totalCost: Prisma.Decimal;
  plan: ConsumptionPlanEntry[];
}

export const inventoryService = {
  /**
   * FIFO stock draw-down: consumes oldest batches first, decrementing
   * quantityRemaining in place, and returns the exact batch/qty/cost split
   * so the caller can persist a BatchConsumption audit trail once the
   * SaleItem row (and its id) exists. Throws if total available stock is
   * short — callers run this inside a transaction so a shortfall rolls
   * back cleanly (no negative stock ever committed).
   */
  async consumeStock(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: Prisma.Decimal.Value,
    productNameForError: string,
  ): Promise<ConsumptionResult> {
    let remaining = toDecimal(quantity);
    const plan: ConsumptionPlanEntry[] = [];
    let totalCost = toDecimal(0);

    const batches = await tx.stockBatch.findMany({
      where: { productId, quantityRemaining: { gt: 0 }, deletedAt: null },
      orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
    });

    for (const batch of batches) {
      if (remaining.lte(0)) break;

      const available = toDecimal(batch.quantityRemaining);
      const take = Prisma.Decimal.min(available, remaining);
      if (take.lte(0)) continue;

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { quantityRemaining: available.sub(take) },
      });

      plan.push({ batchId: batch.id, quantity: take, unitCost: toDecimal(batch.purchasePrice) });
      totalCost = totalCost.add(take.mul(batch.purchasePrice));
      remaining = remaining.sub(take);
    }

    if (remaining.gt(0)) {
      const totalAvailable = toDecimal(quantity).sub(remaining);
      throw AppError.badRequest(
        `Insufficient stock for "${productNameForError}". Requested ${quantity}, only ${totalAvailable} available.`,
      );
    }

    return { totalCost: round2(totalCost), plan };
  },

  /** Persists the audit rows for a consumption plan against a real (now-created) SaleItem id. */
  async recordConsumption(
    tx: Prisma.TransactionClient,
    saleItemId: string,
    plan: ConsumptionPlanEntry[],
  ) {
    if (plan.length === 0) return;
    await tx.batchConsumption.createMany({
      data: plan.map((p) => ({
        saleItemId,
        batchId: p.batchId,
        quantity: p.quantity,
        unitCost: p.unitCost,
      })),
    });
  },

  /**
   * Returned goods go back into stock as a new batch rather than reversing
   * historical batches (which may already be partially/fully consumed by
   * later sales). unitCost defaults to what was actually paid for the
   * matching line on the original sale (its FIFO-computed average cost),
   * falling back to the product's reference purchase price when there's no
   * linked original sale/item to look up.
   */
  async restockFromReturn(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      quantity: Prisma.Decimal.Value;
      unitCost: Prisma.Decimal.Value;
      returnDate: Date;
      returnId: string;
    },
  ) {
    const quantity = toDecimal(params.quantity);
    if (quantity.lte(0)) return;

    await tx.stockBatch.create({
      data: {
        productId: params.productId,
        purchasePrice: round2(toDecimal(params.unitCost)),
        quantity,
        quantityRemaining: quantity,
        purchaseDate: params.returnDate,
        supplier: "Customer Return",
        returnId: params.returnId,
      },
    });
  },

  /**
   * Reverses every BatchConsumption a sale's items drew, restocking each
   * batch by the exact quantity it gave up and deleting the audit rows.
   * Always safe/lossless — batches are restocked by a relative delta, so it
   * doesn't matter what else has happened to them since. Used before
   * editing a Sale's items (so it can be re-consumed against the new
   * values) or deleting it.
   */
  async reverseConsumptionForSale(tx: Prisma.TransactionClient, saleId: string) {
    const consumptions = await tx.batchConsumption.findMany({
      where: { saleItem: { saleId } },
    });

    for (const c of consumptions) {
      await tx.stockBatch.update({
        where: { id: c.batchId },
        data: { quantityRemaining: { increment: c.quantity } },
      });
    }

    await tx.batchConsumption.deleteMany({ where: { saleItem: { saleId } } });
  },

  /**
   * Reverses the stock batch a Return created, but only if none of it has
   * been resold yet (quantityRemaining still equals quantity) — otherwise
   * a later sale's locked-in cost basis would be silently invalidated.
   * Used before editing or deleting a Return.
   */
  async reverseRestockFromReturn(tx: Prisma.TransactionClient, returnId: string) {
    const batches = await tx.stockBatch.findMany({ where: { returnId } });

    for (const batch of batches) {
      if (!toDecimal(batch.quantityRemaining).equals(toDecimal(batch.quantity))) {
        throw AppError.badRequest(
          `Cannot modify this return — some of the restocked stock has already been sold to another customer.`,
        );
      }
    }

    if (batches.length > 0) {
      await tx.stockBatch.deleteMany({ where: { returnId } });
    }
  },

  async totalRemainingStock(tx: Prisma.TransactionClient, productId: string): Promise<number> {
    const result = await tx.stockBatch.aggregate({
      where: { productId, deletedAt: null },
      _sum: { quantityRemaining: true },
    });
    return Number(result._sum.quantityRemaining ?? 0);
  },
};
