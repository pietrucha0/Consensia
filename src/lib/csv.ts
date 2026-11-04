/**
 * RFC 4180 CSV with a UTF-8 BOM (so Excel shows Polish letters correctly) and a
 * semicolon separator (Excel's default in pl/es/fr locales, where the comma is the
 * decimal mark).
 *
 * Cells that a spreadsheet would treat as formulas (= + - @, tab, CR) are prefixed with
 * an apostrophe: names are typed by members, and "=HYPERLINK(...)" must stay text
 * (CSV/formula injection).
 */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number): string => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}
