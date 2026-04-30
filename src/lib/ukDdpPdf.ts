/**
 * UK DDP Landed-Cost PDF Generator
 * --------------------------------
 * Produces a branded one-page PDF breakdown of the GBP landed cost for a quote
 * (Paris → London, DDP). Used from the totals area in both admin and trade
 * views. Pure client-side via jsPDF — no edge function needed.
 */
import jsPDF from "jspdf";
import { GbpLandedCostResult, FX_BUFFER } from "@/hooks/useGbpLandedCost";

interface BuildPdfArgs {
  quoteRef: string;            // e.g. "QU-22A02A"
  clientName?: string | null;  // optional client / studio name
  quoteCurrency: string;       // working currency on the quote
  cbm: number;
  kg: number;
  mode: "road" | "courier";
  carrier?: string | null;     // selected carrier label from breakdown
  transitDays?: { min: number | null; max: number | null };
  gbp: GbpLandedCostResult;
}

// Maison palette (deep jade) — matches studio-guide PDFs
const JADE = [12, 49, 47] as const;     // #0C312F
const JADE_SOFT = [70, 99, 96] as const;
const RULE = [200, 198, 192] as const;
const FG = [40, 40, 40] as const;

const fmtGbp = (cents: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);

export function buildUkDdpPdf({
  quoteRef,
  clientName,
  quoteCurrency,
  cbm,
  kg,
  mode,
  carrier,
  transitDays,
  gbp,
}: BuildPdfArgs): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 56; // page margin

  // -------- Header band
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(0, 0, pageW, 92, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MAISON AFFLUENCY", M, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("UK Landed-Cost Estimate - Delivered Duty Paid", M, 60);
  doc.text("Paris to London", M, 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(quoteRef, pageW - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    }),
    pageW - M,
    60,
    { align: "right" }
  );
  if (clientName) doc.text(clientName, pageW - M, 74, { align: "right" });

  // -------- Body
  let y = 132;
  doc.setTextColor(FG[0], FG[1], FG[2]);

  // Section: Shipment summary
  sectionTitle(doc, "Shipment summary", M, y);
  y += 22;
  twoCol(doc, M, y, "Origin", "Paris, France (FR)");
  twoCol(doc, M + (pageW - 2 * M) / 2, y, "Destination", "London, United Kingdom (GB)");
  y += 30;
  twoCol(doc, M, y, "Mode", mode === "road" ? "Road - white-glove" : "Courier - express");
  twoCol(
    doc,
    M + (pageW - 2 * M) / 2,
    y,
    "Carrier",
    carrier ? `${carrier}${transitDays?.min ? ` (${transitDays.min}-${transitDays.max} days)` : ""}` : "—"
  );
  y += 30;
  twoCol(doc, M, y, "Volume", `${cbm.toFixed(2)} CBM`);
  twoCol(doc, M + (pageW - 2 * M) / 2, y, "Weight", `${kg} kg`);
  y += 32;

  // Section: Goods
  sectionTitle(doc, "Goods value", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Goods, net of trade discount", fmtGbp(gbp.goodsGbpCents));
  y += 22;

  // Section: Freight breakdown
  sectionTitle(doc, "Freight & logistics", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Base freight (Paris to London)", fmtGbp(gbp.freightGbpCents));
  y += 16;
  if (gbp.fuelGbpCents > 0) { costRow(doc, M, y, pageW - M, "Fuel surcharge", fmtGbp(gbp.fuelGbpCents)); y += 16; }
  if (gbp.insuranceGbpCents > 0) { costRow(doc, M, y, pageW - M, "Cargo insurance", fmtGbp(gbp.insuranceGbpCents)); y += 16; }
  if (gbp.customsGbpCents > 0) { costRow(doc, M, y, pageW - M, "Customs clearance", fmtGbp(gbp.customsGbpCents)); y += 16; }
  if (gbp.handlingGbpCents > 0) { costRow(doc, M, y, pageW - M, "Handling & documentation", fmtGbp(gbp.handlingGbpCents)); y += 16; }
  if (gbp.lastMileGbpCents > 0) { costRow(doc, M, y, pageW - M, "Last-mile delivery (London)", fmtGbp(gbp.lastMileGbpCents)); y += 16; }
  // subtotal rule
  rule(doc, M, y - 6, pageW - M);
  costRow(doc, M, y + 8, pageW - M, "Shipping subtotal", fmtGbp(gbp.shippingGbpCents), true);
  y += 30;

  // Section: UK taxes
  sectionTitle(doc, "UK import taxes (DDP)", M, y);
  y += 22;
  const dutyPct = gbp.breakdown ? (gbp.breakdown.duty_cents / Math.max(1, gbp.goodsEurCents)) * 100 : 0;
  const vatPct = gbp.breakdown
    ? (gbp.breakdown.vat_cents /
        Math.max(1, gbp.goodsEurCents + gbp.breakdown.freight_cents + gbp.breakdown.duty_cents)) * 100
    : 0;
  costRow(doc, M, y, pageW - M, `Import duty (${dutyPct.toFixed(1)}% — furniture/lighting)`, fmtGbp(gbp.dutyGbpCents));
  y += 16;
  costRow(doc, M, y, pageW - M, `UK VAT (${vatPct.toFixed(0)}% on goods + freight + duty)`, fmtGbp(gbp.vatGbpCents));
  y += 28;

  // Total band
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(M, y, pageW - 2 * M, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DDP delivered London — all in", M + 14, y + 27);
  doc.setFontSize(16);
  doc.text(fmtGbp(gbp.totalGbpCents), pageW - M - 14, y + 28, { align: "right" });
  y += 60;

  // Disclaimers
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Notes", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const notes = [
    `Indicative estimate. Freight is calculated on declared volume (${cbm.toFixed(2)} CBM) and weight (${kg} kg) — actual crating may vary on confirmation.`,
    `Prices include UK customs clearance, import duty and VAT under Delivered Duty Paid (DDP) — no further charges on delivery to London.`,
    `FX: ${quoteCurrency} → GBP via EUR pivot @ ${gbp.fxEurGbp?.toFixed(4)} (EUR→GBP) including a +${(FX_BUFFER * 100).toFixed(0)}% buffer to cushion currency movement between quote and invoice. Final GBP invoice issued on order confirmation.`,
    ...(gbp.fxIsFallback
      ? [`⚠ Live FX feed unavailable at the time of generation — figures use a fallback indicative rate. Treat the GBP total as approximate (≈).`]
      : []),
    `Working currency on the quote remains ${quoteCurrency}. This document is a courtesy landed-cost view for the UK end-client.`,
  ];
  notes.forEach((n) => {
    const wrapped = doc.splitTextToSize(n, pageW - 2 * M);
    doc.text(wrapped, M, y);
    y += wrapped.length * 11 + 4;
  });

  // Footer
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.line(M, pageH - 56, pageW - M, pageH - 56);
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Maison Affluency · Paris", M, pageH - 38);
  doc.text("hello@maisonaffluency.com · maisonaffluency.com", M, pageH - 26);
  doc.text(`Estimate ref. ${quoteRef} · DDP-GB`, pageW - M, pageH - 26, { align: "right" });

  return doc;
}

// ---------- helpers
function sectionTitle(doc: jsPDF, label: string, x: number, y: number) {
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(label.toUpperCase(), x, y);
  doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
  doc.setLineWidth(0.6);
  doc.line(x, y + 4, x + 40, y + 4);
  doc.setTextColor(FG[0], FG[1], FG[2]);
}
function twoCol(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text(value, x, y + 12);
}
function costRow(
  doc: jsPDF, xL: number, y: number, xR: number,
  label: string, value: string, bold = false,
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(10);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text(label, xL, y);
  doc.text(value, xR, y, { align: "right" });
}
function rule(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.4);
  doc.line(x1, y, x2, y);
}

/** Trigger a download in the browser using a blob URL (session-safe). */
export function downloadUkDdpPdf(args: BuildPdfArgs) {
  const doc = buildUkDdpPdf(args);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.quoteRef}-uk-ddp-estimate.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
