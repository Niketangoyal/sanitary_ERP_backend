/** Minimal dependency-free CSV builder — opens natively in Excel/Sheets, no third-party parser risk. */
export const buildCsv = (headers: string[], rows: (string | number)[][]): string => {
  const escapeCell = (value: string | number): string => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))];
  return lines.join("\r\n");
};
