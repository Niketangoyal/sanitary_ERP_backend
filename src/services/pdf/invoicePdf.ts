import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Settings } from "@prisma/client";
import { buildLetterhead, buildFooter, pdfStyles } from "../../utils/pdf/common";
import { formatMoneyPdf, formatDatePdf } from "../../utils/pdf/format";

interface SaleForPdf {
  invoiceNumber: string;
  invoiceDate: Date;
  subtotal: unknown;
  discountTotal: unknown;
  gstTotal: unknown;
  grandTotal: unknown;
  notes: string | null;
  customer: {
    companyName: string;
    contactPerson: string | null;
    address: string | null;
    mobile: string;
    gstNumber: string | null;
  };
  items: {
    itemName: string;
    quantity: unknown;
    rate: unknown;
    discountPercent: unknown;
    gstPercent: unknown;
    total: unknown;
  }[];
}

export const buildInvoicePdfDefinition = (
  sale: SaleForPdf,
  settings: Settings,
): TDocumentDefinitions => {
  const itemRows: Content[][] = sale.items.map((item, index) => [
    { text: String(index + 1), style: "cell" },
    { text: item.itemName, style: "cell" },
    { text: String(item.quantity), style: "cell", alignment: "right" },
    { text: formatMoneyPdf(item.rate as string), style: "cell", alignment: "right" },
    { text: `${item.discountPercent}%`, style: "cell", alignment: "right" },
    { text: `${item.gstPercent}%`, style: "cell", alignment: "right" },
    { text: formatMoneyPdf(item.total as string), style: "cell", alignment: "right" },
  ]);

  return {
    styles: {
      ...pdfStyles,
      cell: { fontSize: 8.5 },
    },
    footer: buildFooter(),
    content: [
      buildLetterhead(settings, "TAX INVOICE"),
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "BILL TO", style: "sectionLabel" },
              { text: sale.customer.companyName, bold: true, fontSize: 11 },
              ...(sale.customer.contactPerson ? [{ text: sale.customer.contactPerson }] : []),
              ...(sale.customer.address ? [{ text: sale.customer.address }] : []),
              { text: `Mobile: ${sale.customer.mobile}` },
              ...(sale.customer.gstNumber ? [{ text: `GSTIN: ${sale.customer.gstNumber}` }] : []),
            ],
          },
          {
            width: "auto",
            stack: [
              { text: [{ text: "Invoice No: ", bold: true }, sale.invoiceNumber] },
              { text: [{ text: "Date: ", bold: true }, formatDatePdf(sale.invoiceDate)] },
            ],
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: [20, "*", 35, 55, 40, 35, 60],
          body: [
            [
              { text: "#", style: "tableHeader" },
              { text: "Item", style: "tableHeader" },
              { text: "Qty", style: "tableHeader", alignment: "right" },
              { text: "Rate", style: "tableHeader", alignment: "right" },
              { text: "Disc %", style: "tableHeader", alignment: "right" },
              { text: "GST %", style: "tableHeader", alignment: "right" },
              { text: "Amount", style: "tableHeader", alignment: "right" },
            ],
            ...itemRows,
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          hLineColor: () => "#CBD5E1",
          vLineWidth: () => 0,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 220,
            table: {
              widths: ["*", "auto"],
              body: [
                [{ text: "Subtotal", style: "cell" }, { text: formatMoneyPdf(sale.subtotal as string), style: "cell", alignment: "right" }],
                [{ text: "Discount", style: "cell" }, { text: `- ${formatMoneyPdf(sale.discountTotal as string)}`, style: "cell", alignment: "right" }],
                [{ text: "GST", style: "cell" }, { text: `+ ${formatMoneyPdf(sale.gstTotal as string)}`, style: "cell", alignment: "right" }],
                [{ text: "Grand Total", style: "totalLabel" }, { text: formatMoneyPdf(sale.grandTotal as string), style: "totalValue", alignment: "right" }],
              ],
            },
            layout: "noBorders",
            margin: [0, 8, 0, 0],
          },
        ],
      },
      ...(sale.notes
        ? [{ text: "NOTES", style: "sectionLabel", margin: [0, 16, 0, 2] as [number, number, number, number] }, { text: sale.notes, fontSize: 8.5 }]
        : []),
      ...(settings.invoiceFooter
        ? [{ text: settings.invoiceFooter, style: "muted", margin: [0, 20, 0, 0] as [number, number, number, number] }]
        : []),
    ],
  };
};
