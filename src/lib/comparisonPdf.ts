import { jsPDF } from "jspdf";
import { formatPdfDate } from "@/lib/pdfFormatting";

export interface ComparisonPdfPiece {
  name: string;
  values: Record<string, string>;
  image?: { data: string; width: number; height: number } | null;
}

export async function comparisonImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Product picture unavailable");
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Product picture unavailable"); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return { data: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
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
  if (pieces.some(p => p.image)) {
    pieces.forEach((piece, index) => {
      if (!piece.image) return;
      const scale = Math.min((colW - 4) / piece.image.width, 40 / piece.image.height);
      const width = piece.image.width * scale, height = piece.image.height * scale;
      doc.addImage(piece.image.data, "JPEG", M + labelW + index * colW + (colW - 4 - width) / 2, y + (40 - height) / 2, width, height);
    });
    y += 45;
  }
  doc.setFont("helvetica", "bold");
  const heads = pieces.map((p) => doc.splitTextToSize(p.name, colW - 4));
  heads.forEach((h, i) => doc.text(h, M + labelW + i * colW, y));
  y += Math.max(...heads.map((h) => h.length), 1) * 4.5;
  doc.line(M, y - 2, W - M, y - 2);
  y += 4;
  for (const row of rows) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const cells = pieces.map((p) => doc.splitTextToSize(p.values[row.key] || "—", colW - 4));
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const labelLines = doc.splitTextToSize(row.label.replace(/\u2212/g, "-").toUpperCase(), labelW - 6);
    const h = Math.max(Math.max(...cells.map((c) => c.length), 1) * 4.5, labelLines.length * 4) + 3;
    if (y + h > 195) { doc.addPage(); y = 20; }
    doc.text(labelLines, M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    cells.forEach((c, i) => doc.text(c, M + labelW + i * colW, y));
    y += h;
    doc.setDrawColor(220); doc.line(M, y - 3, W - M, y - 3); doc.setDrawColor(0);
  }
  doc.setFontSize(7);
  doc.text("Prices subject to confirmation. maisonaffluency.com", M, 202);
  return doc.output("blob");
}
