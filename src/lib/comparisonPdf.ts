import { jsPDF } from "jspdf";
import { formatPdfDate } from "@/lib/pdfFormatting";
import { DEFAULT_COVER_THEME, hexToRgb } from "@/lib/pdfCoverTheme";
import { comparatorDimensionGroups } from "./comparatorDimensions";
import { comparisonSectionPages } from "./comparisonPdfLayout";

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
  swatches?: ComparisonPdfSwatch[];
}

export interface ComparisonPdfSwatch { name: string; color?: string | null; image?: ComparisonPdfPiece["image"] }

export async function comparisonImage(url: string, cropSquare = false) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Product picture unavailable");
  const bitmap = await createImageBitmap(await response.blob());
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const scale = Math.min(1, (cropSquare ? 100 : 900) / (cropSquare ? sourceSize : Math.max(bitmap.width, bitmap.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((cropSquare ? sourceSize : bitmap.width) * scale); canvas.height = Math.round((cropSquare ? sourceSize : bitmap.height) * scale);
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Product picture unavailable"); }
  if (cropSquare) context.drawImage(bitmap, (bitmap.width - sourceSize) / 2, (bitmap.height - sourceSize) / 2, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
  else context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { data: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
}

/** Branded landscape side-by-side comparison. Callers decide which rows (e.g. trade price) are included. */
export async function buildComparisonPdf(pieces: ComparisonPdfPiece[], rows: { key: string; label: string }[], title = "Product Comparison", cover: ComparisonPdfCover = {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  await embedComparisonFonts(doc);
  doc.setProperties({ title: `${cover.projectName?.trim() || "Product Selection"} — ${title}`, author: "Maison Affluency" });
  drawComparisonCover(doc, cover, title, pieces.length);
  const W = 297, H = 210, M = 14, labelW = 39, endY = 191;
  const colW = (W - M * 2 - labelW) / Math.max(pieces.length, 1);
  const css = getComputedStyle(document.documentElement);
  const palette = (role: string): [number, number, number] => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF colours unavailable");
    ctx.fillStyle = `hsl(${css.getPropertyValue(`--comparison-pdf-${role}`).trim()})`;
    ctx.fillRect(0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  };
  const colors = { paper: palette("paper"), ink: palette("ink"), muted: palette("muted"), rule: palette("rule"), image: palette("image"), trade: palette("trade") };
  const bodyFont = 8, lineH = 3.8;
  const textLines = (text: string, width = colW - 6) => {
    doc.setFont("Inter", "normal").setFontSize(bodyFont);
    return doc.splitTextToSize(text || "—", width) as string[];
  };
  const dimensionLines = (text: string) => comparatorDimensionGroups(text).flatMap(g => [
    ...(g.name ? [g.name] : []),
    ...g.rows.map(r => `${r.label}: ${r.metric} (${r.imperial})`),
    ...(g.note ? [g.note] : []),
  ]).flatMap(line => textLines(line));
  type Section = { key: string; label: string; cells: string[][]; swatches?: ComparisonPdfSwatch[][]; height: number };
  const sections: Section[] = rows.flatMap(row => {
    if (row.key === "materials") {
      const samples = pieces.map(p => p.swatches ?? []);
      // A compact six-sample summary keeps prices with the product grid; the full library follows separately.
      return [{ key: row.key, label: row.label, cells: samples.map(s => [s.length > 6 ? `+${s.length - 6} further finishes` : ""]), swatches: samples.map(s => s.slice(0, 6)), height: 18 }];
    }
    const cells = pieces.map(p => row.key === "dimensions" ? dimensionLines(p.values[row.key] || "") : textLines(p.values[row.key] || "—"));
    const chunkSize = 30;
    const maxLines = Math.max(1, ...cells.map(c => c.length));
    return Array.from({ length: Math.ceil(maxLines / chunkSize) }, (_, i) => {
      const chunk = cells.map(c => c.slice(i * chunkSize, (i + 1) * chunkSize));
      const label = i ? `${row.label} (continued)` : row.label;
      const labelLines = textLines(label.toUpperCase(), labelW - 5);
      return { key: row.key, label, cells: chunk, height: Math.max(...chunk.map(c => c.length), labelLines.length, 1) * lineH + 5 };
    });
  });
  const names = pieces.map(p => { doc.setFont("Cormorant", "normal").setFontSize(13); return doc.splitTextToSize(p.name, colW - 6) as string[]; });
  const nameHeight = Math.max(...names.map(n => n.length), 1) * 4.6 + 5;
  const totalSections = sections.reduce((sum, row) => sum + row.height, 0);
  const imageHeight = Math.max(27, Math.min(43, endY - 30 - nameHeight - totalSections));
  const firstY = 30 + imageHeight + 4 + nameHeight;
  const pages = comparisonSectionPages(sections.map(s => s.height), endY - firstY, endY - 30 - nameHeight);
  const coverPages = doc.getNumberOfPages() - 1;
  const heading = (withImages: boolean) => {
    doc.setFillColor(...colors.paper).rect(0, 0, W, H, "F");
    doc.setFont("Cormorant", "normal").setFontSize(17).setTextColor(...colors.ink);
    doc.text("MAISON AFFLUENCY", M, 14);
    doc.setFont("Inter", "normal").setFontSize(8).setTextColor(...colors.muted);
    doc.text(title, M, 21); doc.text(formatPdfDate(new Date(), "en-GB"), W - M, 14, { align: "right" });
    let y = 30;
    if (withImages) {
      pieces.forEach((piece, index) => {
        const x = M + labelW + index * colW;
        doc.setFillColor(...colors.image).rect(x, y, colW - 5, imageHeight, "F");
        if (!piece.image) return;
        const scale = Math.min((colW - 7) / piece.image.width, (imageHeight - 2) / piece.image.height);
        const w = piece.image.width * scale, h = piece.image.height * scale;
        doc.addImage(piece.image.data, "JPEG", x + (colW - 5 - w) / 2, y + (imageHeight - h) / 2, w, h);
      });
      y += imageHeight + 4;
    }
    doc.setFont("Cormorant", "normal").setFontSize(13).setTextColor(...colors.ink);
    names.forEach((lines, i) => doc.text(lines, M + labelW + i * colW, y + 4, { lineHeightFactor: 1 }));
    y += nameHeight;
    doc.setDrawColor(...colors.rule).setLineWidth(0.2).line(M, y, W - M, y);
    return y;
  };
  const drawSwatch = (swatch: ComparisonPdfSwatch, x: number, y: number, size: number) => {
    if (swatch.image) doc.addImage(swatch.image.data, "JPEG", x, y, size, size);
    else {
      const color = swatch.color?.replace(/^#([a-f0-9])([a-f0-9])([a-f0-9])$/i, "#$1$1$2$2$3$3");
      doc.setFillColor(...(color && /^#[a-f0-9]{6}$/i.test(color) ? hexToRgb(color) : colors.image));
      doc.roundedRect(x, y, size, size, 0.4, 0.4, "F");
      if (!color) {
        doc.setFont("Inter", "normal").setFontSize(4.5).setTextColor(...colors.muted);
        doc.text(swatch.name.split(/\s+/).slice(0, 2).map(v => v[0]).join(""), x + size / 2, y + size / 2 + 0.6, { align: "center" });
      }
    }
  };
  pages.forEach((indexes, pageIndex) => {
    if (pageIndex) doc.addPage();
    let y = heading(pageIndex === 0);
    for (const index of indexes) {
      const section = sections[index];
      const trade = section.key === "trade_price_cents";
      if (trade) doc.setFillColor(...colors.trade).rect(M, y, W - M * 2, section.height, "F");
      doc.setFont("Inter", "normal").setFontSize(7).setTextColor(...colors.muted);
      doc.text(textLines(section.label.replace(/−/g, "-").toUpperCase(), labelW - 5), M, y + 4.5);
      pieces.forEach((_, i) => {
        const x = M + labelW + i * colW;
        if (section.swatches) {
          section.swatches[i].forEach((s, j) => drawSwatch(s, x + j * 7.5, y + 3, 6));
          doc.setFont("Inter", "normal").setFontSize(6.5).setTextColor(...colors.muted);
          doc.text(section.cells[i][0] || "", x, y + 13);
        } else {
          doc.setFont("Inter", "normal").setFontSize(bodyFont).setTextColor(...colors.ink);
          section.cells[i].forEach((line, j) => {
            if (section.key === "dimensions" && /\(.* in\)$/.test(line)) {
              const at = line.lastIndexOf(" ("); const main = line.slice(0, at), imperial = line.slice(at);
              doc.text(main, x, y + 4.5 + j * lineH);
              const width = doc.getTextWidth(main);
              doc.setTextColor(...colors.muted).setFontSize(7).text(imperial, x + width, y + 4.5 + j * lineH);
              doc.setTextColor(...colors.ink).setFontSize(bodyFont);
            } else doc.text(line, x, y + 4.5 + j * lineH);
          });
        }
      });
      y += section.height;
      doc.setDrawColor(...colors.rule).line(M, y, W - M, y);
    }
  });
  // Print has no hover/popover: preserve every named finish in an aligned visual appendix.
  if (pieces.some(p => (p.swatches?.length ?? 0) > 0)) {
    let y = endY;
    const maxSwatches = Math.max(...pieces.map(p => p.swatches?.length ?? 0));
    for (let index = 0; index < maxSwatches; index += 2) {
      const sampleW = (colW - 4) / 2;
      doc.setFont("Inter", "normal").setFontSize(6);
      const lines = pieces.map(p => [0, 1].map(j => doc.splitTextToSize(p.swatches?.[index + j]?.name || "", sampleW - 8) as string[]));
      const h = Math.max(7, ...lines.flatMap(pair => pair.map(l => l.length * 2.8 + 2)));
      if (y + h > endY) {
        doc.addPage(); y = heading(false);
        doc.setFont("Inter", "normal").setFontSize(8).setTextColor(...colors.muted);
        doc.text("MATERIALS & FINISHES", M, y + 5); y += 11;
      }
      pieces.forEach((p, i) => {
        [0, 1].forEach(j => {
          const swatch = p.swatches?.[index + j]; if (!swatch) return;
          const x = M + labelW + i * colW + j * sampleW;
          drawSwatch(swatch, x, y + 1, 5);
          doc.setFont("Inter", "normal").setFontSize(6).setTextColor(...colors.ink);
          doc.text(lines[i][j], x + 7, y + 3, { lineHeightFactor: 1.3 });
        });
      });
      y += h;
    }
  }
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    const onCover = page <= coverPages;
    doc.setFont("Inter", "normal").setFontSize(7).setTextColor(...(onCover ? hexToRgb(DEFAULT_COVER_THEME.text) : colors.muted));
    doc.text(`Page ${page} of ${total} | Maison Affluency Trade Portal`, W / 2, 204, { align: "center" });
  }
  return doc.output("blob");
}
