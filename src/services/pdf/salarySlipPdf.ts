import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Settings } from "@prisma/client";
import { buildLetterhead, buildFooter, pdfStyles } from "../../utils/pdf/common";
import { formatMoneyPdf, formatDatePdf } from "../../utils/pdf/format";
import { PAYMENT_MODE_LABELS } from "../../utils/labels";
import dayjs from "dayjs";

const STATUS_LABEL: Record<string, string> = { PAID: "Paid", PENDING: "Pending", PARTIAL: "Partially Paid" };

interface SalarySlipInput {
  salaryNumber: string;
  month: number;
  year: number;
  baseSalary: unknown;
  paidLeaveDays: unknown;
  unpaidLeaveDays: unknown;
  leaveDeduction: unknown;
  advanceDeduction: unknown;
  grossSalary: unknown;
  netPay: unknown;
  amountPaid: unknown;
  balanceDue: unknown;
  paymentStatus: string;
  employee: {
    employeeCode: string;
    fullName: string;
    department: string | null;
    designation: string | null;
  };
  payments?: {
    paymentDate: Date | string;
    amount: unknown;
    paymentMethod: string;
    remarks: string | null;
    recordedBy?: { name: string } | null;
  }[];
}

export const buildSalarySlipPdfDefinition = (
  record: SalarySlipInput,
  settings: Settings,
  remainingAdvance = 0,
): TDocumentDefinitions => {
  const periodLabel = dayjs(`${record.year}-${String(record.month).padStart(2, "0")}-01`).format("MMMM YYYY");
  const payments = record.payments ?? [];

  const paymentRows: Content[][] = payments.map((p): Content[] => [
    { text: formatDatePdf(p.paymentDate), style: "cell" },
    { text: formatMoneyPdf(p.amount), style: "cell", alignment: "right" },
    { text: PAYMENT_MODE_LABELS[p.paymentMethod] ?? p.paymentMethod, style: "cell" },
    { text: p.recordedBy?.name ?? "-", style: "cell" },
    { text: p.remarks ?? "-", style: "cell" },
  ]);

  return {
    styles: { ...pdfStyles, cell: { fontSize: 9 } },
    footer: buildFooter(),
    content: [
      buildLetterhead(settings, "SALARY SLIP"),
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "EMPLOYEE", style: "sectionLabel" },
              { text: record.employee.fullName, bold: true, fontSize: 12 },
              { text: `Code: ${record.employee.employeeCode}` },
              ...(record.employee.designation ? [{ text: record.employee.designation }] : []),
              ...(record.employee.department ? [{ text: record.employee.department }] : []),
            ],
          },
          {
            width: "auto",
            stack: [
              { text: [{ text: "Slip No: ", bold: true }, record.salaryNumber] },
              { text: [{ text: "Period: ", bold: true }, periodLabel] },
              { text: [{ text: "Status: ", bold: true }, STATUS_LABEL[record.paymentStatus] ?? record.paymentStatus] },
            ],
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ["*", "auto"],
          body: [
            [{ text: "Gross Salary", style: "cell" }, { text: formatMoneyPdf(record.grossSalary), style: "cell", alignment: "right" }],
            [
              { text: `Leave Deduction (${record.unpaidLeaveDays} unpaid day(s), ${record.paidLeaveDays} paid)`, style: "cell" },
              { text: `- ${formatMoneyPdf(record.leaveDeduction)}`, style: "cell", alignment: "right" },
            ],
            [{ text: "Advance Deduction", style: "cell" }, { text: `- ${formatMoneyPdf(record.advanceDeduction)}`, style: "cell", alignment: "right" }],
            [{ text: "Net Pay", style: "totalLabel" }, { text: formatMoneyPdf(record.netPay), style: "totalValue", alignment: "right" }],
            [{ text: "Amount Paid", style: "cell" }, { text: formatMoneyPdf(record.amountPaid), style: "cell", alignment: "right" }],
            [{ text: "Remaining Salary", style: "totalLabel" }, { text: formatMoneyPdf(record.balanceDue), style: "totalValue", alignment: "right" }],
            ...(remainingAdvance > 0
              ? ([[{ text: "Remaining Advance Balance", style: "cell" }, { text: formatMoneyPdf(remainingAdvance), style: "cell", alignment: "right" }]] as Content[][])
              : []),
          ],
        },
        layout: "noBorders",
      },
      ...(payments.length > 0
        ? ([
            { text: "SALARY PAYMENT HISTORY", style: "sectionLabel", margin: [0, 20, 0, 6] as [number, number, number, number] },
            {
              table: {
                headerRows: 1,
                widths: [65, 70, 70, "*", "*"],
                body: [
                  [
                    { text: "Date", style: "tableHeader" },
                    { text: "Amount", style: "tableHeader", alignment: "right" },
                    { text: "Method", style: "tableHeader" },
                    { text: "Recorded By", style: "tableHeader" },
                    { text: "Remarks", style: "tableHeader" },
                  ],
                  ...paymentRows,
                ],
              },
              layout: {
                hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
                  i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
                hLineColor: () => "#CBD5E1",
                vLineWidth: () => 0,
                paddingTop: () => 3,
                paddingBottom: () => 3,
              },
            },
          ] as Content[])
        : []),
    ],
  };
};
