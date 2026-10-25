import { jsPDF } from "jspdf";
import { formatPdfDate } from "@/lib/pdfFormatting";
import { DEFAULT_COVER_THEME, hexToRgb } from "@/lib/pdfCoverTheme";

export interface ComparisonPdfCover {
  projectName?: string | null;
  comparisonName?: string | null;
  clientName?: string | null;
  location?: string | null;
  style?: string | null;
}

async function embedComparisonFonts(doc: jsPDF) {
  await Promise.all([
    ["Inter", "/fonts/pdf/Inter-Light.ttf"],
    ["Cormorant", "/fonts/pdf/CormorantGaramond-Regular.ttf"],
  ].map(async ([name, path]) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("PDF font unavailable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    doc.addFileToVFS(`${name}.ttf`, btoa(binary));
    doc.addFont(`${name}.ttf`, name, "normal");
  }));
}

function drawComparisonCover(doc: jsPDF, cover: ComparisonPdfCover, title: string, count: number) {
  const theme = DEFAULT_COVER_THEME;
  const M = 24, W = 297, H = 210;
  doc.setFillColor(...hexToRgb(theme.background)).rect(0, 0, W, H, "F");
  doc.setFont("Cormorant", "normal").setFontSize(26).setTextColor(...hexToRgb(theme.text));
  doc.text("MAISON AFFLUENCY", M, 30);
  doc.setDrawColor(...hexToRgb(theme.accent)).setLineWidth(0.4).line(M, 39, M + 55, 39);
  doc.setFont("Inter", "normal").setFontSize(9).setTextColor(...hexToRgb(theme.accent));
  doc.text(title.toUpperCase(), M, 57);
  doc.setFont("Cormorant", "normal").setTextColor(...hexToRgb(theme.text));
  let size = 36;
  const projectName = cover.projectName?.trim() || "Product Selection";
  doc.setFontSize(size);
  let nameLines: string[] = doc.splitTextToSize(projectName, W - M * 2);
  while (nameLines.length > 3 && size > 12) {
    size -= 1; doc.setFontSize(size); nameLines = doc.splitTextToSize(projectName, W - M * 2);
  }
  doc.text(nameLines, M, 78, { lineHeightFactor: 1.1 });
  let y = 78 + nameLines.length * size * 0.39 + 8;
  doc.setFont("Inter", "normal").setFontSize(11);
  if (cover.comparisonName?.trim()) {
    const lines: string[] = doc.splitTextToSize(cover.comparisonName.trim(), W - M * 2);
    doc.text(lines, M, y); y += lines.length * 4.5 + 7;
  }
  const details = [
    ["CLIENT", cover.clientName?.trim()],
    ["LOCATION", cover.location?.trim()],
    ["STYLE", cover.style?.trim()],
  ].filter((row): row is [string, string] => !!row[1]);
  doc.setFontSize(10);
  const valueW = W - M * 2 - 34;
  const detailLines = details.map(([label, value]) => ({ label, lines: doc.splitTextToSize(value, valueW) as string[] }));
  const height = detailLines.reduce((sum, row) => sum + row.lines.length * 4.5 + 4, 0);
  // Long recorded details continue on another branded page rather than being clipped.
  if (y + height > 181) {
    doc.addPage(); doc.setFillColor(...hexToRgb(theme.background)).rect(0, 0, W, H, "F"); y = 30;
  }
  for (const { label, lines } of detailLines) {
    doc.setFont("Inter", "normal").setFontSize(8).setTextColor(...hexToRgb(theme.accent));
    doc.text(label, M, y);
    doc.setFontSize(10).setTextColor(...hexToRgb(theme.text));
    for (const line of lines) {
      if (y > 181) { doc.addPage(); doc.setFillColor(...hexToRgb(theme.background)).rect(0, 0, W, H, "F"); y = 30; }
      doc.text(line, M + 34, y); y += 4.5;
    }
    y += 4;
  }
  doc.setFont("Inter", "normal").setFontSize(8).setTextColor(...hexToRgb(theme.accent));
  doc.text(`${count} ${count === 1 ? "PIECE" : "PIECES"}  /  ${formatPdfDate(new Date(), "en-GB")}`, M, 193);
  doc.text("maisonaffluency.com", W - M, 193, { align: "right" });
  doc.addPage(); doc.setTextColor(0); doc.setDrawColor(0);
}

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
export async function buildComparisonPdf(pieces: ComparisonPdfPiece[], rows: { key: string; label: string }[], title = "Product Comparison", cover: ComparisonPdfCover = {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  await embedComparisonFonts(doc);
  doc.setProperties({ title: `${cover.projectName?.trim() || "Product Selection"} — ${title}`, author: "Maison Affluency" });
  drawComparisonCover(doc, cover, title, pieces.length);
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
