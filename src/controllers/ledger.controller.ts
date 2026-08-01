import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ledgerService } from "../services/ledger.service";
import { settingsService } from "../services/settings.service";
import { generatePdfBuffer } from "../utils/pdf/printer";
import { buildLedgerPdfDefinition } from "../services/pdf/ledgerPdf";

const parseRange = (query: Record<string, string | undefined>) => ({
  from: query.from ? new Date(query.from) : undefined,
  to: query.to ? new Date(`${query.to}T23:59:59.999`) : undefined,
});

export const ledgerController = {
  getStatement: asyncHandler(async (req: Request, res: Response) => {
    const range = parseRange(req.query as Record<string, string>);
    const data = await ledgerService.getStatement(req.params.customerId, range);
    res.json({ success: true, data });
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const range = parseRange(req.query as Record<string, string>);
    const [statement, settings] = await Promise.all([
      ledgerService.getStatement(req.params.customerId, range),
      settingsService.getOrCreate(),
    ]);
    const buffer = await generatePdfBuffer(
      buildLedgerPdfDefinition(statement, settings, {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      }),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Ledger-${statement.customer.companyName}.pdf"`,
    );
    res.send(buffer);
  }),
};
