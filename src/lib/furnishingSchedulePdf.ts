import { jsPDF } from "jspdf";
import { formatPdfDate, formatPdfMoney } from "@/lib/pdfFormatting";

export interface ScheduleRow {
  name: string;
  manufacturer?: string | null;
  priceEur: number | null;
  dimensions?: string | null;
}

export function scheduleTotalEur(rows: ScheduleRow[]): number {
  return rows.reduce((sum, r) => sum + (r.priceEur ?? 0), 0);
}

export function buildFurnishingSchedulePdf(rows: ScheduleRow[], title: string): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const money = (eur: number | null) => formatPdfMoney(eur == null ? null : Math.round(eur * 100), "EUR", "en-GB", "Price upon Request");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MAISON AFFLUENCY", 15, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Furnishing Schedule — ${title}`, 15, 26);
  doc.setFontSize(9);
  doc.text(formatPdfDate(new Date(), "en-GB"), 195, 18, { align: "right" });

  const cols = [15, 23, 90, 135, 195];
  let y = 38;
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.text("#", cols[0], y); doc.text("Piece", cols[1], y); doc.text("Dimensions", cols[2], y);
    doc.text("Price", cols[4], y, { align: "right" });
    doc.line(15, y + 2, 195, y + 2);
    doc.setFont("helvetica", "normal");
    y += 8;
  };
  header();
  rows.forEach((r, i) => {
    const name = doc.splitTextToSize(r.manufacturer ? `${r.name}\n${r.manufacturer}` : r.name, 64);
    const dims = doc.splitTextToSize((r.dimensions || "Dimensions upon request").replace(/\s*\n\s*/g, " / "), 70);
    const h = Math.max(name.length, dims.length) * 4.5 + 3;
    if (y + h > 280) { doc.addPage(); y = 20; header(); }
    doc.text(String(i + 1), cols[0], y);
    doc.text(name, cols[1], y);
    doc.text(dims, cols[2], y);
    doc.text(money(r.priceEur), cols[4], y, { align: "right" });
    y += h;
  });
  doc.line(15, y - 1, 195, y - 1);
  doc.setFont("helvetica", "bold");
  doc.text("Total", cols[1], y + 5);
  doc.text(money(scheduleTotalEur(rows)), cols[4], y + 5, { align: "right" });
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
