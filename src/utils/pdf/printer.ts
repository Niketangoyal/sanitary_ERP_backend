import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfkit's built-in Base-14 fonts (Helvetica) ship inside the library itself
// as AFM metrics, so no TTF files need to be bundled or downloaded.
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

export const generatePdfBuffer = (docDefinition: TDocumentDefinitions): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument({
        defaultStyle: { font: "Helvetica", fontSize: 9 },
        pageSize: "A4",
        pageMargins: [32, 32, 32, 40],
        ...docDefinition,
      });

      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
};
