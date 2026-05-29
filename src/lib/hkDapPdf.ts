/**
 * Hong Kong DAP Landed-Cost PDF Generator
 * ---------------------------------------
 * Branded one-page PDF breakdown of the HKD landed cost for a quote
 * (Paris → Hong Kong, DAP). HK is a free port: import duty & VAT are 0%.
 * Mirrors ukDdpPdf.ts so the two estimates feel consistent in the studio.
 */
import jsPDF from "jspdf";
import { HkdLandedCostResult, HkMode } from "@/hooks/useHkdLandedCost";
import { FX_BUFFER } from "@/hooks/useGbpLandedCost";

interface PdfOriginShipment {
  country: string;        // ISO-2
  modeLabel: string;      // "Air freight", "Sea LCL", ...
  totalCbm: number;
  totalKg: number;
  hkdCents: number;       // freight+duty+VAT in HKD for line amount
}

export interface HkDapPageArgs {
  quoteRef: string;
  clientName?: string | null;
  quoteCurrency: string;
  cbm: number;
  kg: number;
  mode: HkMode;
  carrier?: string | null;
  transitDays?: { min: number | null; max: number | null };
  hkd: HkdLandedCostResult;
  /** When provided, the PDF lists each origin shipment with its mode
   *  instead of showing the single panel-level "Mode" cell. */
  origins?: PdfOriginShipment[];
}
// Back-compat alias
type BuildPdfArgs = HkDapPageArgs;

const JADE = [12, 49, 47] as const;
const JADE_SOFT = [70, 99, 96] as const;
const RULE = [200, 198, 192] as const;
const FG = [40, 40, 40] as const;

const fmtHkd = (cents: number) =>
  new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);

/**
 * Render the HK DAP estimate onto the *current* page of `doc`.
 * Assumes the page is fresh (e.g. just created via `doc.addPage()` or a new jsPDF).
 */
export function renderHkDapPage(doc: jsPDF, args: HkDapPageArgs): void {
  const { quoteRef, clientName, quoteCurrency, cbm, kg, mode, carrier, transitDays, hkd, origins } = args;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 56;


  // Header band
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(0, 0, pageW, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MAISON AFFLUENCY", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Hong Kong Landed-Cost Estimate - Delivered At Place", M, 60);
  doc.text(
    origins && origins.length > 0
      ? `${origins.length} shipment${origins.length > 1 ? "s" : ""} to Hong Kong`
      : "Paris to Hong Kong",
    M, 74
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(quoteRef, pageW - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    pageW - M, 60, { align: "right" }
  );
  if (clientName) doc.text(clientName, pageW - M, 74, { align: "right" });

  let y = 132;
  doc.setTextColor(FG[0], FG[1], FG[2]);

  // Shipment summary
  sectionTitle(doc, "Shipment summary", M, y);
  y += 22;

  const hasOrigins = !!(origins && origins.length > 0);
  if (hasOrigins) {
    // Per-origin list — one row per shipment with its own mode.
    const totalCbm = origins!.reduce((s, o) => s + o.totalCbm, 0);
    const totalKg = origins!.reduce((s, o) => s + o.totalKg, 0);
    twoCol(doc, M, y, "Destination", "Hong Kong (HK)");
    twoCol(doc, M + (pageW - 2 * M) / 2, y, "Shipments",
      `${origins!.length} · ${totalCbm.toFixed(2)} CBM · ${Math.round(totalKg)} kg`);
    y += 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
    doc.text("ORIGINS & MODES", M, y);
    doc.text("SHIPPING (HKD)", pageW - M, y, { align: "right" });
    y += 12;
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.setFontSize(9.5);
    origins!.forEach((o) => {
      const left = `${o.country} -> HK  ·  ${o.modeLabel}  ·  ${o.totalCbm.toFixed(2)} CBM  ·  ${Math.round(o.totalKg)} kg`;
      doc.text(left, M, y);
      doc.text(fmtHkd(o.hkdCents), pageW - M, y, { align: "right" });
      y += 14;
    });
    y += 8;
  } else {
    twoCol(doc, M, y, "Origin", "Paris, France (FR)");
    twoCol(doc, M + (pageW - 2 * M) / 2, y, "Destination", "Hong Kong (HK)");
    y += 30;
    twoCol(doc, M, y, "Mode", mode === "air" ? "Air freight" : "Sea LCL");
    twoCol(
      doc, M + (pageW - 2 * M) / 2, y,
      "Carrier",
      carrier ? `${carrier}${transitDays?.min ? ` (${transitDays.min}-${transitDays.max} days)` : ""}` : "—"
    );
    y += 30;
    twoCol(doc, M, y, "Volume", `${cbm.toFixed(2)} CBM`);
    twoCol(doc, M + (pageW - 2 * M) / 2, y, "Weight", `${kg} kg`);
    y += 32;
  }

  // Goods
  sectionTitle(doc, "Goods value", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Goods, net of trade discount", fmtHkd(hkd.goodsHkdCents));
  y += 22;

  // Freight breakdown — collapse to a simple "Shipping" subtotal when no
  // component-level rollup is present (per-line shipping mode).
  const hasFreightComponents =
    hkd.freightHkdCents > 0 || hkd.fuelHkdCents > 0 || hkd.insuranceHkdCents > 0 ||
    hkd.customsHkdCents > 0 || hkd.handlingHkdCents > 0 || hkd.lastMileHkdCents > 0;
  sectionTitle(doc, hasFreightComponents ? "Freight & logistics" : "Shipping", M, y);
  y += 22;
  if (hasFreightComponents) {
    if (hkd.freightHkdCents > 0) { costRow(doc, M, y, pageW - M, "Base freight (Paris to Hong Kong)", fmtHkd(hkd.freightHkdCents)); y += 16; }
    if (hkd.fuelHkdCents > 0) { costRow(doc, M, y, pageW - M, "Fuel / BAF surcharge", fmtHkd(hkd.fuelHkdCents)); y += 16; }
    if (hkd.insuranceHkdCents > 0) { costRow(doc, M, y, pageW - M, "Cargo insurance", fmtHkd(hkd.insuranceHkdCents)); y += 16; }
    if (hkd.customsHkdCents > 0) { costRow(doc, M, y, pageW - M, "Customs clearance (HK)", fmtHkd(hkd.customsHkdCents)); y += 16; }
    if (hkd.handlingHkdCents > 0) { costRow(doc, M, y, pageW - M, "Handling & documentation", fmtHkd(hkd.handlingHkdCents)); y += 16; }
    if (hkd.lastMileHkdCents > 0) { costRow(doc, M, y, pageW - M, "Last-mile delivery (Hong Kong)", fmtHkd(hkd.lastMileHkdCents)); y += 16; }
    rule(doc, M, y - 6, pageW - M);
    costRow(doc, M, y + 8, pageW - M, "Shipping subtotal", fmtHkd(hkd.shippingHkdCents), true);
  } else {
    costRow(doc, M, y, pageW - M, "Shipping subtotal (sum of per-shipment costs above)", fmtHkd(hkd.shippingHkdCents), true);
    y -= 8;
  }
  // EUR equivalent sub-line so the studio sees both currencies at a glance.
  if (hkd.shippingEurCents > 0) {
    const fmtE = (cents: number) =>
      new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
        .format((cents || 0) / 100);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
    doc.text(`~ ${fmtE(hkd.shippingEurCents)} EUR equivalent`, pageW - M, y + 20, { align: "right" });
    doc.setTextColor(FG[0], FG[1], FG[2]);
    y += 12;
  }
  y += 30;

  // Taxes (HK = free port → 0)
  sectionTitle(doc, "Hong Kong import taxes (DAP)", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Import duty (Hong Kong free port - 0%)", fmtHkd(hkd.dutyHkdCents));
  y += 16;
  costRow(doc, M, y, pageW - M, "Sales tax / VAT (none in Hong Kong)", fmtHkd(hkd.vatHkdCents));
  y += 28;

  // Total band
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(M, y, pageW - 2 * M, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DAP delivered Hong Kong - all in", M + 14, y + 27);
  doc.setFontSize(16);
  doc.text(fmtHkd(hkd.totalHkdCents), pageW - M - 14, y + 28, { align: "right" });
  y += 60;

  // Notes
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Notes", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const notes = [
    hasOrigins
      ? `Indicative estimate. Freight is summed from per-line packing across ${origins!.length} shipment${origins!.length > 1 ? "s" : ""} (${origins!.reduce((s, o) => s + o.totalCbm, 0).toFixed(2)} CBM · ${Math.round(origins!.reduce((s, o) => s + o.totalKg, 0))} kg) - actual crating may vary on confirmation. Modes (sea LCL / air freight) are taken from each line's chosen mode.`
      : `Indicative estimate. Freight is calculated on declared volume (${cbm.toFixed(2)} CBM) and weight (${kg} kg) - actual crating may vary on confirmation.`,
    `Hong Kong is a free port: no import duty and no sales tax / VAT. DAP terms cover origin handling, international freight, HK customs clearance and inland delivery to the consignee address. Receiver is responsible for any local building access or installation fees.`,
    `FX: ${quoteCurrency} to HKD via EUR pivot @ ${hkd.fxEurHkd?.toFixed(4)} (EUR to HKD) including a +${(FX_BUFFER * 100).toFixed(0)}% buffer to cushion currency movement between quote and invoice. Final HKD invoice issued on order confirmation.`,
    ...(hkd.fxIsFallback
      ? [`Note: Live FX feed unavailable at the time of generation - figures use a fallback indicative rate. Treat the HKD total as approximate.`]
      : []),
    `Working currency on the quote remains ${quoteCurrency}. This document is a courtesy landed-cost view for the Hong Kong end-client.`,
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
  doc.text("Maison Affluency - Paris", M, pageH - 38);
  doc.text("hello@maisonaffluency.com - maisonaffluency.com", M, pageH - 26);
  doc.text(`Estimate ref. ${quoteRef} - DAP-HK`, pageW - M, pageH - 26, { align: "right" });

}

/** Create a standalone HK DAP PDF (single page). */
export function buildHkDapPdf(args: HkDapPageArgs): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderHkDapPage(doc, args);
  return doc;
}

/** Append the HK DAP estimate as a new page on an existing jsPDF. */
export function appendHkDapPage(doc: jsPDF, args: HkDapPageArgs): void {
  doc.addPage();
  renderHkDapPage(doc, args);
}

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
function costRow(doc: jsPDF, xL: number, y: number, xR: number, label: string, value: string, bold = false) {
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

export function downloadHkDapPdf(args: BuildPdfArgs) {
  const doc = buildHkDapPdf(args);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.quoteRef}-hk-dap-estimate.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
