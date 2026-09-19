/**
 * Hong Kong DAP Landed-Cost PDF Generator
 * ---------------------------------------
 * Branded one-page Hong Kong DAP summary.
 *
 * This renderer deliberately performs no landed-cost arithmetic. Every money
 * field is inherited from the immutable totals snapshot already used on page 1.
 */
import jsPDF from "jspdf";

export interface QuotePageTotalsSnapshot {
  currency: string;
  netSubtotalCents: number;
  premiumPackingCents: number;
  orderTotalCents: number;
  fxLabel: string | null;
}

export interface HkDapPageArgs {
  quoteRef: string;
  clientName?: string | null;
  quoteCurrency: string;
  cbm: number;
  kg: number;
  mode: "air" | "sea_lcl";
  carrier?: string | null;
  transitDays?: { min: number | null; max: number | null };
  shipmentCount?: number;
  /** Required page-1 snapshot. Page 3 never accepts a separate cost model. */
  quoteTotals: QuotePageTotalsSnapshot;
}
// Back-compat alias
type BuildPdfArgs = HkDapPageArgs;

const JADE = [12, 49, 47] as const;
const JADE_SOFT = [70, 99, 96] as const;
const RULE = [200, 198, 192] as const;
const FG = [40, 40, 40] as const;

const fmtMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

/**
 * Render the HK DAP estimate onto the *current* page of `doc`.
 * Assumes the page is fresh (e.g. just created via `doc.addPage()` or a new jsPDF).
 */
export function renderHkDapPage(doc: jsPDF, args: HkDapPageArgs): void {
  const { quoteRef, clientName, quoteCurrency, cbm, kg, mode, carrier, transitDays, shipmentCount, quoteTotals } = args;
  const money = (cents: number) => fmtMoney(cents, quoteTotals.currency);
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
    `${shipmentCount || 1} shipment${(shipmentCount || 1) > 1 ? "s" : ""} to Hong Kong`,
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

  twoCol(doc, M, y, "Origin", "As specified on quote");
  twoCol(doc, M + (pageW - 2 * M) / 2, y, "Destination", "Hong Kong (HK)");
  y += 30;
  twoCol(doc, M, y, "Mode", mode === "air" ? "Air freight" : "Sea LCL");
  twoCol(doc, M + (pageW - 2 * M) / 2, y, "Carrier", carrier ? `${carrier}${transitDays?.min ? ` (${transitDays.min}-${transitDays.max} days)` : ""}` : "—");
  y += 30;
  twoCol(doc, M, y, "Volume", `${cbm.toFixed(2)} CBM`);
  twoCol(doc, M + (pageW - 2 * M) / 2, y, "Weight", `${kg} kg`);
  y += 32;

  // Goods
  sectionTitle(doc, "Goods value", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Goods, net of trade discount", money(quoteTotals.netSubtotalCents));
  y += 22;

  sectionTitle(doc, "Crating fees", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Premium Packing", money(quoteTotals.premiumPackingCents));
  y += 34;

  // Taxes (HK = free port → 0)
  sectionTitle(doc, "Hong Kong import taxes (DAP)", M, y);
  y += 22;
  costRow(doc, M, y, pageW - M, "Import duty (Hong Kong free port - 0%)", money(0));
  y += 16;
  costRow(doc, M, y, pageW - M, "Sales tax / VAT (none in Hong Kong)", money(0));
  y += 28;

  // Total band
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(M, y, pageW - 2 * M, 44, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DAP delivered Hong Kong - all in", M + 14, y + 27);
  doc.setFontSize(16);
  doc.text(money(quoteTotals.orderTotalCents), pageW - M - 14, y + 28, { align: "right" });
  y += 60;

  // Notes
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Notes", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const noteOne = `Indicative estimate. Freight is summed from per-line packing across ${shipmentCount || 1} shipment${(shipmentCount || 1) > 1 ? "s" : ""}.`;
  const noteTwo = "Hong Kong is a free port: no import duty and no sales tax / VAT.";
  const noteThree = quoteTotals.fxLabel || `Working currency on the quote remains ${quoteCurrency}.`;
  const noteFour = "The final total is inherited directly from the primary quote document.";
  y = drawNote(doc, noteOne, M, y, pageW - 2 * M);
  y = drawNote(doc, noteTwo, M, y, pageW - 2 * M);
  y = drawNote(doc, noteThree, M, y, pageW - 2 * M);
  drawNote(doc, noteFour, M, y, pageW - 2 * M);

  // Footer
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.line(M, pageH - 56, pageW - M, pageH - 56);
  doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Maison Affluency", M, pageH - 38);
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
function drawNote(doc: jsPDF, text: string, x: number, y: number, width: number): number {
  const wrapped = doc.splitTextToSize(text, width);
  doc.text(wrapped, x, y);
  return y + wrapped.length * 11 + 4;
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
