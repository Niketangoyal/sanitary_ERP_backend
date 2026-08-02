import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Settings, LeaveRecord, Employee } from "@prisma/client";
import { buildLetterhead, buildFooter, pdfStyles } from "../../utils/pdf/common";
import { formatDatePdf } from "../../utils/pdf/format";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  PAID: "Paid",
  UNPAID: "Unpaid",
  OTHER: "Other",
};

type LeaveRow = LeaveRecord & { employee: Employee };

export const buildLeaveReportPdfDefinition = (
  rows: LeaveRow[],
  settings: Settings,
  rangeLabel: string | null,
): TDocumentDefinitions => {
  const bodyRows: Content[][] = rows.map((r): Content[] => [
    { text: r.employee.fullName, style: "cell" },
    { text: LEAVE_TYPE_LABEL[r.leaveType], style: "cell" },
    { text: formatDatePdf(r.fromDate), style: "cell" },
    { text: formatDatePdf(r.toDate), style: "cell" },
    { text: String(r.totalDays), style: "cell", alignment: "right" },
    { text: r.reason ?? "-", style: "cell" },
  ]);

  const totalDays = rows.reduce((sum, r) => sum + Number(r.totalDays), 0);

  return {
    pageOrientation: "landscape",
    styles: { ...pdfStyles, cell: { fontSize: 8.5 } },
    footer: buildFooter(),
    content: [
      buildLetterhead(settings, "LEAVE REPORT"),
      ...(rangeLabel
        ? [{ text: rangeLabel, style: "muted", margin: [0, 0, 0, 12] as [number, number, number, number] }]
        : []),
      {
        table: {
          headerRows: 1,
          widths: ["*", 80, 65, 65, 50, "*"],
          body: [
            [
              { text: "Employee", style: "tableHeader" },
              { text: "Leave Type", style: "tableHeader" },
              { text: "From", style: "tableHeader" },
              { text: "To", style: "tableHeader" },
              { text: "Days", style: "tableHeader", alignment: "right" },
              { text: "Reason", style: "tableHeader" },
            ],
            ...bodyRows,
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
            width: 200,
            table: {
              widths: ["*", "auto"],
              body: [
                [{ text: "Records", style: "cell" }, { text: String(rows.length), style: "cell", alignment: "right" }],
                [{ text: "Total Days", style: "totalLabel" }, { text: String(totalDays), style: "totalValue", alignment: "right" }],
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
