import fs from "fs";
import path from "path";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Settings } from "@prisma/client";
import { env } from "../../config/env";
import { formatDateTimePdf } from "./format";

const resolveLogoDataUri = (logoUrl: string | null): string | undefined => {
  if (!logoUrl) return undefined;
  try {
    const filename = path.basename(logoUrl);
    const filePath = path.resolve(process.cwd(), env.UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return undefined;
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    if (mime === "image/webp") return undefined; // pdfkit can't decode webp
    const base64 = fs.readFileSync(filePath).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return undefined;
  }
};

/** Business letterhead block (name, address, GST, phone, optional logo) shared by every generated PDF. */
export const buildLetterhead = (settings: Settings, documentTitle: string): Content => {
  const logo = resolveLogoDataUri(settings.logoUrl);

  const businessBlock: Content = {
    stack: [
      { text: settings.businessName, style: "businessName", margin: [0, 0, 0, 3] },
      ...(settings.address ? [{ text: settings.address, style: "muted" }] : []),
      ...(settings.gstNumber ? [{ text: `GSTIN: ${settings.gstNumber}`, style: "muted" }] : []),
      ...(settings.phone ? [{ text: `Phone: ${settings.phone}`, style: "muted" }] : []),
    ],
  };

  return {
    columns: [
      logo
        ? { image: logo, width: 56, height: 56, margin: [0, 0, 12, 0] }
        : { text: "", width: 0 },
      businessBlock,
      { text: documentTitle, style: "documentTitle", alignment: "right", width: "auto" },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 12],
  };
};

export const pdfStyles: TDocumentDefinitions["styles"] = {
  businessName: { fontSize: 15, bold: true, color: "#0D3F6E" },
  muted: { fontSize: 8.5, color: "#555555" },
  documentTitle: { fontSize: 16, bold: true, color: "#145C9E" },
  sectionLabel: { fontSize: 8, bold: true, color: "#777777" },
  tableHeader: { fontSize: 8.5, bold: true, fillColor: "#EEF3F8" },
  totalLabel: { fontSize: 9.5, bold: true },
  totalValue: { fontSize: 9.5, bold: true, color: "#145C9E" },
};

export const buildFooter = (): TDocumentDefinitions["footer"] => {
  return (currentPage: number, pageCount: number) => ({
    columns: [
      { text: `Generated on ${formatDateTimePdf(new Date())}`, style: "muted", margin: [32, 0, 0, 0] },
      { text: `Page ${currentPage} of ${pageCount}`, style: "muted", alignment: "right", margin: [0, 0, 32, 0] },
    ],
    margin: [0, 8, 0, 0] as [number, number, number, number],
  });
};
