import { jsPDF } from "jspdf";
import { formatPdfMoney, formatPdfDate } from "@/lib/pdfFormatting";

export interface TradeCoverSheetInput {
  productName: string;
  brand: string;
  dimensions?: string | null;
  materials?: string | null;
  leadTime?: string | null;
  retailCents: number;
  netCents: number;
  currency: string;
  studioName: string;
  tierLabel: string;
  discountPct: number; // 0.10 = 10%
  project?: string | null;
}

/** Derives the cover-sheet margin rows; discount = retail − net so the figures always reconcile. */
export function coverSheetFigures(i: Pick<TradeCoverSheetInput, "retailCents" | "netCents">) {
  return { retail: i.retailCents, discount: i.retailCents - i.netCents, net: i.netCents };
}

export function buildTradeCoverSheetPdf(i: TradeCoverSheetInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  const fig = coverSheetFigures(i);
  const money = (c: number) => formatPdfMoney(c, i.currency);

  // Page 1 — confidential cover
  doc.setTextColor(17);
  doc.setFont("times", "normal").setFontSize(30);
  doc.text("MAISON AFFLUENCY", M, 190);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(110);
  doc.text("STUDIO COVERSHEET  ·  CONFIDENTIAL TRADE SPECIFICATION", M, 212, { charSpace: 1 });
  doc.text(formatPdfDate(new Date()), W - M, 212, { align: "right" });

  let y = 270;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 12 : 10);
    doc.setTextColor(bold ? 17 : 100);
    doc.text(label, M, y);
    doc.setTextColor(bold ? 17 : 50);
    const lines = doc.splitTextToSize(value, W - M * 2 - 200);
    doc.text(lines, W - M, y, { align: "right" });
    y += 26 + (lines.length - 1) * 12;
  };
  row("Piece", i.productName);
  row("Maker", i.brand);
  row("Project Reference", i.project?.trim() || "Studio Sourcing");
  row("Designer Account", i.studioName);
  row("Trade Tier", `${i.tierLabel}`);
  y += 10;
  doc.setDrawColor(221).line(M, y - 16, W - M, y - 16);
  row("Public Retail Price (RRP)", money(fig.retail), true);
  row(`Contract Tier Discount (${Math.round(i.discountPct * 100)}%)`, `-${money(fig.discount)}`, true);
  doc.setFillColor(246, 244, 239).rect(M - 8, y - 18, W - M * 2 + 16, 28, "F");
  row("Net Trade Procurement Cost", money(fig.net), true);

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(150);
  doc.text(
    doc.splitTextToSize(
      "CONFIDENTIALITY NOTICE: This document contains proprietary trade pricing and contract discount parameters specific to your Maison Affluency professional studio status. Do not distribute this coversheet to end clients.",
      W - M * 2,
    ),
    M,
    760,
  );

  // Page 2 — technical
  doc.addPage();
  doc.setTextColor(17).setFont("times", "normal").setFontSize(20);
  doc.text(doc.splitTextToSize(`TECHNICAL SPECIFICATIONS: ${i.productName.toUpperCase()}`, W - M * 2), M, 90);
  y = 150;
  const tech: [string, string | null | undefined][] = [
    ["Origin / Manufacturer", i.brand],
    ["Dimensions", i.dimensions],
    ["Primary Materials", i.materials],
    ["Lead Time", i.leadTime?.replace(/^lead\s*time:?\s*/i, "")],
  ];
  for (const [label, value] of tech) {
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(17);
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal").setTextColor(60);
    const lines = doc.splitTextToSize(value?.trim() || "On request", W - M * 2 - 190);
    doc.text(lines, W - M, y, { align: "right" });
    y += 14 + lines.length * 13;
    doc.setDrawColor(235).line(M, y - 12, W - M, y - 12);
    y += 6;
  }
  return doc.output("blob");
}
