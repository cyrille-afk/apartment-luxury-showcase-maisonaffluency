import { jsPDF } from "jspdf";
import { formatPdfDate } from "@/lib/pdfFormatting";

export interface ComparisonPdfPiece {
  name: string;
  values: Record<string, string>;
}

/** Branded landscape side-by-side comparison. Callers decide which rows (e.g. trade price) are included. */
export function buildComparisonPdf(pieces: ComparisonPdfPiece[], rows: { key: string; label: string }[], title = "Product Comparison"): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, M = 15, labelW = 42;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("MAISON AFFLUENCY", M, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(title, M, 26);
  doc.setFontSize(9);
  doc.text(formatPdfDate(new Date(), "en-GB"), W - M, 18, { align: "right" });
  const colW = (W - 2 * M - labelW) / Math.max(pieces.length, 1);
  let y = 38;
  doc.setFont("helvetica", "bold");
  const heads = pieces.map((p) => doc.splitTextToSize(p.name, colW - 4));
  heads.forEach((h, i) => doc.text(h, M + labelW + i * colW, y));
  y += Math.max(...heads.map((h) => h.length), 1) * 4.5;
  doc.line(M, y - 2, W - M, y - 2);
  y += 4;
  for (const row of rows) {
    const cells = pieces.map((p) => doc.splitTextToSize(p.values[row.key] || "—", colW - 4));
    const h = Math.max(...cells.map((c) => c.length), 1) * 4.5 + 3;
    if (y + h > 195) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(row.label.replace(/\u2212/g, "-").toUpperCase(), M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    cells.forEach((c, i) => doc.text(c, M + labelW + i * colW, y));
    y += h;
    doc.setDrawColor(220); doc.line(M, y - 3, W - M, y - 3); doc.setDrawColor(0);
  }
  doc.setFontSize(7);
  doc.text("Prices subject to confirmation. maisonaffluency.com", M, 202);
  return doc.output("blob");
}
