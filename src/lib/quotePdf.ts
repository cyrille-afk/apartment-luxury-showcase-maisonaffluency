/**
 * Quote PDF Generator
 * -------------------
 * Produces a clean, branded multi-page PDF of a Maison Affluency quote.
 * Pure client-side via jsPDF — bypasses the browser print dialog so no
 * URL / date / page-number headers and footers are injected by Chrome/Safari.
 *
 * Used from the "Download PDF" button on the QuoteDetail screen.
 */
import jsPDF from "jspdf";

// Maison palette — matches studio-guide / UK DDP PDFs
const JADE = [12, 49, 47] as const;        // #0C312F
const JADE_SOFT = [70, 99, 96] as const;
const RULE = [200, 198, 192] as const;
const FG = [40, 40, 40] as const;
const MUTED = [115, 115, 115] as const;

export interface QuotePdfLine {
  productName: string;
  brandName: string;
  dimensions?: string | null;
  materials?: string | null;
  leadTime?: string | null;
  notes?: string | null;
  quantity: number;
  unitPriceCents: number | null;     // already in quote currency
  lineTotalCents: number | null;     // already in quote currency
}

export interface QuotePdfArgs {
  quoteNumber: string;
  status: string;                    // raw status, e.g. "priced"
  statusLabel: string;               // human label, e.g. "Priced"
  createdAt: Date;
  expiryAt: Date;
  clientName?: string | null;
  projectName?: string | null;
  currency: string;                  // SGD | USD | EUR | GBP
  lines: QuotePdfLine[];
  subtotalCents: number;
  tradeDiscountPct: number;          // 0..1 (e.g. 0.08)
  tradeDiscountApplied: boolean;
  gstEnabled: boolean;
  gstRate: number;                   // percent
  insurancePremiumCents?: number;
  insuranceLabel?: string | null;
  insuranceRateBps?: number;
  notes?: string | null;
}

const currencySymbol = (c: string) => ({ SGD: "S$", USD: "US$", EUR: "EUR ", GBP: "GBP " } as Record<string, string>)[c] || `${c} `;

const fmtMoney = (cents: number | null | undefined, currency: string): string => {
  if (cents == null) return "TBD";
  const sym = currencySymbol(currency);
  return `${sym}${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function buildQuotePdf(args: QuotePdfArgs): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - 2 * M;

  drawHeader(doc, args, pageW, M);

  let y = 168;

  // ---- Meta block (Date / Expiry / Quote # / Client / Project)
  y = drawMetaBlock(doc, args, M, y, contentW);

  // ---- Line items table
  y = drawTable(doc, args, M, y, contentW, pageH);

  // ---- Totals block (right aligned)
  y = ensureSpace(doc, args, y, 220, M, pageW, pageH);
  y = drawTotals(doc, args, M, y, contentW);

  // ---- Notes
  if (args.notes && args.notes.trim()) {
    y = ensureSpace(doc, args, y, 80, M, pageW, pageH);
    y += 18;
    sectionTitle(doc, "Project notes", M, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    const wrapped = doc.splitTextToSize(args.notes.trim(), contentW);
    doc.text(wrapped, M, y);
    y += wrapped.length * 12;
  }

  // ---- Payment terms
  y = ensureSpace(doc, args, y, 120, M, pageW, pageH);
  y += 22;
  sectionTitle(doc, "Payment terms", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  const terms = [
    "60% deposit due on order confirmation; 40% balance due before shipment.",
    "Payment by bank transfer (no fee) or by card via Stripe (processing fee applies).",
    "Lead times start from receipt of cleared deposit and finalised specifications.",
    `Quote valid until ${fmtDate(args.expiryAt)}. Pricing in ${args.currency} unless otherwise stated.`,
  ];
  terms.forEach((t) => {
    const wrapped = doc.splitTextToSize(`• ${t}`, contentW);
    doc.text(wrapped, M, y);
    y += wrapped.length * 11 + 2;
  });

  // ---- Footer on every page
  drawFooterAllPages(doc, args, pageW, pageH, M);

  return doc;
}

// -------- Header band ---------------------------------------------------
function drawHeader(doc: jsPDF, args: QuotePdfArgs, pageW: number, M: number) {
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(0, 0, pageW, 120, "F");

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MAISON AFFLUENCY", M, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Curated furniture, lighting and objets for trade", M, 68);
  doc.text("Affluency Etc Pte. Ltd. - Singapore", M, 82);

  // Right side: Quote ref + status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("QUOTE", pageW - M, 50, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(args.quoteNumber, pageW - M, 70, { align: "right" });

  // Status pill
  const label = args.statusLabel.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const pillW = doc.getTextWidth(label) + 18;
  const pillX = pageW - M - pillW;
  const pillY = 82;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pillX, pillY, pillW, 16, 8, 8, "F");
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text(label, pillX + pillW / 2, pillY + 11, { align: "center" });

  // hairline below header
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(M, 110, pageW - M, 110);
}

// -------- Meta block ----------------------------------------------------
function drawMetaBlock(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  const colW = contentW / 4;
  const labels = [
    ["DATE", fmtDate(args.createdAt)],
    ["EXPIRY", fmtDate(args.expiryAt)],
    ["CLIENT", args.clientName || "—"],
    ["PROJECT", args.projectName || "—"],
  ];
  labels.forEach(([label, value], i) => {
    const x = M + colW * i;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    const wrapped = doc.splitTextToSize(String(value), colW - 8);
    doc.text(wrapped[0], x, y + 14);
  });
  return y + 38;
}

// -------- Items table ---------------------------------------------------
function drawTable(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number, pageH: number): number {
  // Columns: Description (flex), Qty, Unit, Amount
  const colQty = 50;
  const colUnit = 90;
  const colAmt = 90;
  const colDesc = contentW - colQty - colUnit - colAmt;
  const xQty = M + colDesc;
  const xUnit = xQty + colQty;
  const xAmt = xUnit + colUnit;
  const rowRight = M + contentW;

  // header row
  doc.setFillColor(245, 244, 240);
  doc.rect(M, y, contentW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("DESCRIPTION", M + 8, y + 14);
  doc.text("QTY", xQty + colQty / 2, y + 14, { align: "center" });
  doc.text("UNIT PRICE", xUnit + colUnit - 4, y + 14, { align: "right" });
  doc.text(`AMOUNT (${args.currency})`, rowRight - 4, y + 14, { align: "right" });
  y += 28;

  // body rows
  doc.setTextColor(FG[0], FG[1], FG[2]);
  args.lines.forEach((line) => {
    // estimate row height: 1 line title + brand + optional dims/materials/lead/notes
    const meta = [line.dimensions, line.materials, line.leadTime, line.notes].filter(Boolean) as string[];
    const titleWrap = doc.splitTextToSize(line.productName || "—", colDesc - 16);
    const metaHeight = meta.length * 10;
    const titleHeight = titleWrap.length * 12;
    const rowH = Math.max(40, 12 /* brand */ + titleHeight + metaHeight + 10);

    // page break
    if (y + rowH > pageH - 90) {
      doc.addPage();
      y = 60;
      // repeat header
      doc.setFillColor(245, 244, 240);
      doc.rect(M, y, contentW, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(JADE[0], JADE[1], JADE[2]);
      doc.text("DESCRIPTION", M + 8, y + 14);
      doc.text("QTY", xQty + colQty / 2, y + 14, { align: "center" });
      doc.text("UNIT PRICE", xUnit + colUnit - 4, y + 14, { align: "right" });
      doc.text(`AMOUNT (${args.currency})`, rowRight - 4, y + 14, { align: "right" });
      y += 28;
      doc.setTextColor(FG[0], FG[1], FG[2]);
    }

    // brand
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const brand = (line.brandName || "").includes(" - ")
      ? line.brandName.split(" - ")[0].trim()
      : (line.brandName || "");
    if (brand) doc.text(brand.toUpperCase(), M + 8, y + 4);

    // title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(titleWrap, M + 8, y + 16);

    // meta lines
    let metaY = y + 16 + titleHeight + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    meta.forEach((m) => {
      const wrapped = doc.splitTextToSize(m, colDesc - 16);
      doc.text(wrapped[0], M + 8, metaY);
      metaY += 10;
    });

    // qty / unit / amount
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(String(line.quantity), xQty + colQty / 2, y + 16, { align: "center" });
    doc.text(fmtMoney(line.unitPriceCents, args.currency), xUnit + colUnit - 4, y + 16, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmtMoney(line.lineTotalCents, args.currency), rowRight - 4, y + 16, { align: "right" });

    y += rowH;
    // separator
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.3);
    doc.line(M, y - 4, rowRight, y - 4);
  });

  return y + 8;
}

// -------- Totals block --------------------------------------------------
function drawTotals(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  const blockW = 280;
  const x = M + contentW - blockW;
  let cy = y;

  // light fill
  doc.setFillColor(250, 249, 246);
  // dynamic height based on rows we're showing
  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [];
  rows.push({ label: "Subtotal", value: fmtMoney(args.subtotalCents, args.currency) });
  const discountCents = args.tradeDiscountApplied
    ? Math.round(args.subtotalCents * args.tradeDiscountPct)
    : 0;
  if (discountCents > 0) {
    rows.push({
      label: `Trade discount (${Math.round(args.tradeDiscountPct * 100)}%)`,
      value: `− ${fmtMoney(discountCents, args.currency)}`,
      muted: true,
    });
  }
  const afterDiscount = args.subtotalCents - discountCents;
  if (discountCents > 0) {
    rows.push({ label: "Net subtotal", value: fmtMoney(afterDiscount, args.currency) });
  }
  if ((args.insurancePremiumCents || 0) > 0) {
    rows.push({
      label: args.insuranceLabel
        ? `Insurance — ${args.insuranceLabel}${args.insuranceRateBps ? ` (${(args.insuranceRateBps / 100).toFixed(2)}%)` : ""}`
        : "Insurance",
      value: `+ ${fmtMoney(args.insurancePremiumCents!, args.currency)}`,
      muted: true,
    });
  }
  const baseForGst = afterDiscount + (args.insurancePremiumCents || 0);
  const gstCents = args.gstEnabled ? Math.round(baseForGst * args.gstRate / 100) : 0;
  if (args.gstEnabled) {
    rows.push({
      label: `GST (${args.gstRate}%)`,
      value: `+ ${fmtMoney(gstCents, args.currency)}`,
      muted: true,
    });
  }
  const grand = baseForGst + gstCents;
  const deposit = Math.round(grand * 0.6);
  const balance = grand - deposit;

  const rowH = 18;
  const totalH = rows.length * rowH + 80;
  doc.rect(x, cy, blockW, totalH, "F");

  cy += 16;
  rows.forEach((r) => {
    doc.setFont("helvetica", r.strong ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(r.muted ? MUTED[0] : FG[0], r.muted ? MUTED[1] : FG[1], r.muted ? MUTED[2] : FG[2]);
    doc.text(r.label, x + 14, cy);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(`${r.value} ${args.currency}`, x + blockW - 14, cy, { align: "right" });
    cy += rowH;
  });

  // grand total
  doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
  doc.setLineWidth(0.6);
  doc.line(x + 14, cy - 4, x + blockW - 14, cy - 4);
  cy += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("Order total", x + 14, cy);
  doc.text(`${fmtMoney(grand, args.currency)} ${args.currency}`, x + blockW - 14, cy, { align: "right" });
  cy += 18;

  // deposit / balance
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("60% deposit due now", x + 14, cy);
  doc.text(`${fmtMoney(deposit, args.currency)} ${args.currency}`, x + blockW - 14, cy, { align: "right" });
  cy += 14;
  doc.text("40% balance before shipment", x + 14, cy);
  doc.text(`${fmtMoney(balance, args.currency)} ${args.currency}`, x + blockW - 14, cy, { align: "right" });

  return y + totalH + 12;
}

// -------- Helpers -------------------------------------------------------
function sectionTitle(doc: jsPDF, label: string, x: number, y: number) {
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), x, y);
  doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
  doc.setLineWidth(0.6);
  doc.line(x, y + 3, x + 32, y + 3);
  doc.setTextColor(FG[0], FG[1], FG[2]);
}

function ensureSpace(
  doc: jsPDF,
  args: QuotePdfArgs,
  y: number,
  needed: number,
  M: number,
  pageW: number,
  pageH: number,
): number {
  if (y + needed > pageH - 70) {
    doc.addPage();
    return 60;
  }
  return y;
}

function drawFooterAllPages(doc: jsPDF, args: QuotePdfArgs, pageW: number, pageH: number, M: number) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.4);
    doc.line(M, pageH - 56, pageW - M, pageH - 56);
    doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Maison Affluency - hello@maisonaffluency.com - maisonaffluency.com", M, pageH - 38);
    doc.text(
      `${args.quoteNumber} - ${args.statusLabel} - Page ${p} of ${total}`,
      pageW - M,
      pageH - 38,
      { align: "right" },
    );
  }
}

/** Trigger a download in the browser using a blob URL (session-safe). */
export function downloadQuotePdf(args: QuotePdfArgs) {
  const doc = buildQuotePdf(args);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.quoteNumber}-quote.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
