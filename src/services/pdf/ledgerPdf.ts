import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Customer, LedgerEntry, Settings } from "@prisma/client";
import { buildLetterhead, buildFooter, pdfStyles } from "../../utils/pdf/common";
import { formatMoneyPdf, formatDatePdf } from "../../utils/pdf/format";

const LEDGER_TYPE_LABEL: Record<string, string> = {
  OPENING: "Opening Balance",
  SALE: "Sale",
  RETURN: "Return",
  PAYMENT: "Payment",
  ADJUSTMENT: "Adjustment",
};

interface LedgerStatementForPdf {
  customer: Customer;
  openingCashBalance: number;
  openingBillBalance: number;
  entries: LedgerEntry[];
  closingCashBalance: number;
  closingBillBalance: number;
  closingTotalBalance: number;
}

export const buildLedgerPdfDefinition = (
  statement: LedgerStatementForPdf,
  settings: Settings,
  range: { from?: string; to?: string },
): TDocumentDefinitions => {
  const rangeLabel =
    range.from && range.to
      ? `${formatDatePdf(range.from)} to ${formatDatePdf(range.to)}`
      : "Complete history";

  const entryRows: Content[][] = statement.entries.map((entry) => [
    { text: formatDatePdf(entry.entryDate), style: "cell" },
    {
      text: [
        `${entry.description}  `,
        { text: `[${LEDGER_TYPE_LABEL[entry.type]}]`, italics: true, color: "#888888" },
      ],
      style: "cell",
    },
    { text: entry.referenceNumber ?? "-", style: "cell" },
    { text: Number(entry.debit) > 0 ? formatMoneyPdf(Number(entry.debit)) : "-", style: "cell", alignment: "right" },
    { text: Number(entry.credit) > 0 ? formatMoneyPdf(Number(entry.credit)) : "-", style: "cell", alignment: "right" },
    { text: formatMoneyPdf(Number(entry.cashBalanceAfter)), style: "cell", alignment: "right" },
    { text: formatMoneyPdf(Number(entry.billBalanceAfter)), style: "cell", alignment: "right" },
    {
      text: formatMoneyPdf(Number(entry.cashBalanceAfter) + Number(entry.billBalanceAfter)),
      style: "cell",
      alignment: "right",
    },
  ]);

  return {
    pageOrientation: "landscape",
    styles: { ...pdfStyles, cell: { fontSize: 8 } },
    footer: buildFooter(),
    content: [
      buildLetterhead(settings, "STATEMENT OF ACCOUNT"),
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "CUSTOMER", style: "sectionLabel" },
              { text: statement.customer.companyName, bold: true, fontSize: 11 },
              { text: `Mobile: ${statement.customer.mobile}` },
              ...(statement.customer.gstNumber ? [{ text: `GSTIN: ${statement.customer.gstNumber}` }] : []),
            ],
          },
          {
            width: "auto",
            stack: [{ text: [{ text: "Period: ", bold: true }, rangeLabel] }],
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          headerRows: 1,
          widths: [50, "*", 82, 55, 55, 60, 60, 65],
          body: [
            [
              { text: "Date", style: "tableHeader" },
              { text: "Description", style: "tableHeader" },
              { text: "Reference No.", style: "tableHeader" },
              { text: "Debit", style: "tableHeader", alignment: "right" },
              { text: "Credit", style: "tableHeader", alignment: "right" },
              { text: "Cash Balance", style: "tableHeader", alignment: "right" },
              { text: "Bill Balance", style: "tableHeader", alignment: "right" },
              { text: "Closing Balance", style: "tableHeader", alignment: "right" },
            ],
            [
              { text: "", style: "cell" },
              { text: "Opening Balance", style: "cell", bold: true },
              { text: "", style: "cell" },
              { text: "-", style: "cell", alignment: "right" },
              { text: "-", style: "cell", alignment: "right" },
              { text: formatMoneyPdf(statement.openingCashBalance), style: "cell", alignment: "right", bold: true },
              { text: formatMoneyPdf(statement.openingBillBalance), style: "cell", alignment: "right", bold: true },
              {
                text: formatMoneyPdf(statement.openingCashBalance + statement.openingBillBalance),
                style: "cell",
                alignment: "right",
                bold: true,
              },
            ],
            ...entryRows,
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === 2 || i === node.table.body.length ? 1 : 0.5,
          hLineColor: () => "#CBD5E1",
          vLineWidth: () => 0,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 260,
            table: {
              widths: ["*", "auto"],
              body: [
                [{ text: "Cash Account Balance", style: "cell" }, { text: formatMoneyPdf(statement.closingCashBalance), style: "cell", alignment: "right" }],
                [{ text: "Bill Account Balance", style: "cell" }, { text: formatMoneyPdf(statement.closingBillBalance), style: "cell", alignment: "right" }],
                [{ text: "Final Outstanding", style: "totalLabel" }, { text: formatMoneyPdf(statement.closingTotalBalance), style: "totalValue", alignment: "right" }],
              ],
            },
            layout: "noBorders",
            margin: [0, 10, 0, 0],
          },
        ],
      },
    ],
  };
};
