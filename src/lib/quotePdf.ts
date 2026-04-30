/**
 * Quote PDF Generator
 * -------------------
 * Produces a clean, branded multi-page PDF of a Maison Affluency quote.
 * Pure client-side via jsPDF — bypasses the browser print dialog so no
 * URL / date / page-number headers and footers are injected by Chrome/Safari.
 *
 * Includes:
 *   • Affluency logo + full company address block
 *   • Product thumbnails (first gallery image, fetched as data URL)
 *   • Insurance & coverage tier descriptions
 *   • Bank transfer details (IBAN / BIC)
 *   • Terms & Conditions paragraph
 *
 * Used from the "Download PDF" button on the QuoteDetail screen.
 */
import jsPDF from "jspdf";
import affluencyLogoUrl from "@/assets/affluency-quote-logo.jpg";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";

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
  edition?: string | null;
  leadTime?: string | null;
  notes?: string | null;
  quantity: number;
  unitPriceCents: number | null;     // already in quote currency
  lineTotalCents: number | null;     // already in quote currency
  imageUrl?: string | null;          // optional product thumbnail
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
  insuranceEnabled?: boolean;
  notes?: string | null;
  /** Optional UK Landed Cost (GBP DDP London) breakdown — rendered after the main totals block when provided. */
  gbpLanded?: {
    ready: boolean;
    fxEurGbp: number | null;
    fxIsFallback: boolean;
    goodsGbpCents: number;
    shippingGbpCents: number;
    dutyGbpCents: number;
    vatGbpCents: number;
    totalGbpCents: number;
  } | null;
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

/**
 * Fetch an image URL and return a base64 data URL suitable for jsPDF.addImage.
 * Uses Cloudinary auto-optimization for non-Cloudinary URLs (proxy → CORS-safe).
 * Returns null on any failure (network, CORS, missing) so the PDF still renders.
 */
async function fetchImageDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    // Inject a small Cloudinary thumbnail transform — fast + CORS-friendly via fetch proxy
    const optimized = optimizeImageUrl(url, "w_400,h_400,c_fill,q_auto:good,f_jpg");
    const res = await fetch(optimized, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    // Decode dimensions
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export async function buildQuotePdf(args: QuotePdfArgs): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - 2 * M;

  // Pre-fetch logo + product images in parallel (best-effort)
  const [logo, ...productImages] = await Promise.all([
    fetchImageDataUrl(affluencyLogoUrl),
    ...args.lines.map((l) => (l.imageUrl ? fetchImageDataUrl(l.imageUrl) : Promise.resolve(null))),
  ]);

  drawHeader(doc, args, pageW, M, logo);

  let y = 168;

  // ---- Company address block (left) + meta (right)
  y = drawCompanyAndMeta(doc, args, M, y, contentW);

  // ---- Line items table (with thumbnails)
  y = drawTable(doc, args, M, y, contentW, pageH, productImages);

  // ---- Totals block (right aligned)
  y = ensureSpace(doc, y, 220, pageH);
  y = drawTotals(doc, args, M, y, contentW);

  // ---- UK Landed Cost (GBP DDP London) — indicative
  if (args.gbpLanded && args.gbpLanded.ready && args.gbpLanded.totalGbpCents > 0) {
    y = ensureSpace(doc, y, 150, pageH);
    y += 12;
    y = drawGbpLandedBlock(doc, args, M, y, contentW);
  }

  // ---- Insurance & coverage (if enabled)
  if (args.insuranceEnabled) {
    y = ensureSpace(doc, y, 130, pageH);
    y += 18;
    y = drawInsuranceBlock(doc, args, M, y, contentW);
  }

  // ---- Notes
  if (args.notes && args.notes.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(args.notes.trim(), contentW);
    const notesBlockH = 18 /* title */ + 18 /* gap */ + wrapped.length * 12 + 8 /* trailing pad */;
    y = ensureSpace(doc, y, notesBlockH + 18, pageH);
    y += 18;
    sectionTitle(doc, "Project notes", M, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(wrapped, M, y);
    y += wrapped.length * 12;
  }

  // ---- Payment terms + bank details
  y = ensureSpace(doc, y, 200, pageH);
  y += 22;
  y = drawPaymentTerms(doc, args, M, y, contentW);

  // ---- Terms & Conditions
  y = ensureSpace(doc, y, 90, pageH);
  y += 18;
  y = drawTermsAndConditions(doc, M, y, contentW);

  // ---- Branded signature / seal (status-aware)
  y = ensureSpace(doc, y, 160, pageH);
  y += 24;
  drawSignatureSeal(doc, args, M, y, contentW);

  // ---- Footer on every page
  drawFooterAllPages(doc, args, pageW, pageH, M);

  return doc;
}

// -------- Branded signature / seal --------------------------------------
/**
 * Status-aware seal placed on the last page. Renders three blocks:
 *   • Round wax-style seal stamped with the status (Priced / Confirmed / Submitted / Draft)
 *   • Authorised signatory line with name + title + dated stamp
 *   • Client acceptance line for counter-signature on confirmed/submitted quotes
 */
function drawSignatureSeal(
  doc: jsPDF,
  args: QuotePdfArgs,
  M: number,
  y: number,
  contentW: number,
) {
  const status = (args.status || "").toLowerCase();
  // Map status → seal copy + accent
  const seal: { label: string; sub: string; accent: readonly [number, number, number] } = (() => {
    if (status === "confirmed" || status === "paid" || status === "deposit_paid")
      return { label: "CONFIRMED", sub: "Order accepted - production scheduled", accent: [12, 49, 47] as const };
    if (status === "priced")
      return { label: "PRICED", sub: "Issued for client review & acceptance", accent: [12, 49, 47] as const };
    if (status === "submitted" || status === "sent")
      return { label: "SUBMITTED", sub: "Awaiting client confirmation", accent: [120, 92, 36] as const };
    return { label: "DRAFT", sub: "Working draft - not for circulation", accent: [115, 115, 115] as const };
  })();

  const blockH = 130;
  const colW = (contentW - 24) / 2;

  // ----- LEFT: round seal
  const cx = M + 60;
  const cy = y + blockH / 2;
  const r = 48;
  // outer ring
  doc.setDrawColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.setLineWidth(1.4);
  doc.circle(cx, cy, r);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r - 4);
  // inner soft fill
  doc.setFillColor(250, 249, 246);
  doc.circle(cx, cy, r - 6, "F");

  // top arc text - "MAISON AFFLUENCY" (rendered as straight tagline above status)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.text("MAISON AFFLUENCY", cx, cy - 22, { align: "center" });

  // status label (bold, big)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.text(seal.label, cx, cy - 2, { align: "center" });

  // hairline under status
  doc.setDrawColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.setLineWidth(0.4);
  doc.line(cx - 24, cy + 4, cx + 24, cy + 4);

  // quote number + date inside seal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(args.quoteNumber, cx, cy + 14, { align: "center" });
  doc.text(fmtDate(args.createdAt).toUpperCase(), cx, cy + 22, { align: "center" });

  // caption under seal
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const subWrap = doc.splitTextToSize(seal.sub, 130);
  doc.text(subWrap, cx, y + blockH + 12, { align: "center" });

  // ----- RIGHT: signatory + client acceptance lines
  const rx = M + colW + 24 + 20;
  const rWidth = contentW - (colW + 24 + 20);

  // Authorised signatory
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.text("AUTHORISED BY", rx, y + 6);
  doc.setDrawColor(seal.accent[0], seal.accent[1], seal.accent[2]);
  doc.setLineWidth(0.5);
  doc.line(rx, y + 9, rx + 28, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("Maison Affluency", rx, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Trade desk - hello@maisonaffluency.com", rx, y + 38);
  // signature line
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.4);
  doc.line(rx, y + 56, rx + Math.min(rWidth, 220), y + 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Signed ${fmtDate(args.createdAt)}`, rx, y + 66);

  // Client acceptance (only for priced / submitted / confirmed; skip draft)
  if (status !== "draft") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(seal.accent[0], seal.accent[1], seal.accent[2]);
    doc.text("CLIENT ACCEPTANCE", rx, y + 86);
    doc.setDrawColor(seal.accent[0], seal.accent[1], seal.accent[2]);
    doc.setLineWidth(0.5);
    doc.line(rx, y + 89, rx + 36, y + 89);

    // signature + date lines side by side
    const sigW = Math.min(rWidth - 90, 160);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.4);
    doc.line(rx, y + 116, rx + sigW, y + 116);
    doc.line(rx + sigW + 20, y + 116, rx + sigW + 20 + 80, y + 116);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Signature & name", rx, y + 126);
    doc.text("Date", rx + sigW + 20, y + 126);
  }
}


// -------- Header band ---------------------------------------------------
function drawHeader(
  doc: jsPDF,
  args: QuotePdfArgs,
  pageW: number,
  M: number,
  logo: { data: string; w: number; h: number } | null,
) {
  doc.setFillColor(JADE[0], JADE[1], JADE[2]);
  doc.rect(0, 0, pageW, 120, "F");

  // Logo (left of brand text), if available
  let textX = M;
  if (logo) {
    const logoSize = 56;
    try {
      doc.addImage(logo.data, "JPEG", M, 32, logoSize, logoSize);
      textX = M + logoSize + 14;
    } catch {
      /* ignore — fall back to text only */
    }
  }

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MAISON AFFLUENCY", textX, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Curated furniture, lighting and objets for trade", textX, 72);
  doc.text("Affluency Etc Pte. Ltd. - Singapore", textX, 86);

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

// -------- Company address (left) + meta (right) -------------------------
function drawCompanyAndMeta(
  doc: jsPDF,
  args: QuotePdfArgs,
  M: number,
  y: number,
  contentW: number,
): number {
  const colW = contentW / 2;

  // Left: company address
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("AFFLUENCY ETC PTE. LTD.", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  const addressLines = [
    "1 Grange Garden, #16-05",
    "The Grange, 249631",
    "Singapore",
  ];
  addressLines.forEach((ln, i) => {
    doc.text(ln, M, y + 14 + i * 11);
  });

  // Right: meta in 4 mini-columns (Date / Expiry / Client / Project)
  const metaX = M + colW;
  const metaColW = colW / 2;
  const metaRows = [
    [["DATE", fmtDate(args.createdAt)], ["EXPIRY", fmtDate(args.expiryAt)]],
    [["CLIENT", args.clientName || "—"], ["PROJECT", args.projectName || "—"]],
  ];
  metaRows.forEach((row, rIdx) => {
    row.forEach(([label, value], cIdx) => {
      const x = metaX + cIdx * metaColW;
      const ry = y + rIdx * 32;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(label, x, ry);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      const wrapped = doc.splitTextToSize(String(value), metaColW - 8);
      // Render up to 2 lines so values like "Margot Watson — De Beers London" fit.
      const lines = wrapped.slice(0, 2);
      lines.forEach((ln: string, i: number) => {
        doc.text(ln, x, ry + 12 + i * 10);
      });
    });
  });

  return y + 70;
}

// -------- Items table ---------------------------------------------------
function drawTable(
  doc: jsPDF,
  args: QuotePdfArgs,
  M: number,
  y: number,
  contentW: number,
  pageH: number,
  images: (Awaited<ReturnType<typeof fetchImageDataUrl>>)[],
): number {
  // Columns: Image | Description (flex) | Qty | Unit | Amount
  const colImg = 56;
  const colQty = 44;
  const colUnit = 80;
  const colAmt = 84;
  const colDesc = contentW - colImg - colQty - colUnit - colAmt;
  const xImg = M;
  const xDesc = xImg + colImg;
  const xQty = xDesc + colDesc;
  const xUnit = xQty + colQty;
  const xAmt = xUnit + colUnit;
  const rowRight = M + contentW;

  const drawHeaderRow = (yy: number) => {
    doc.setFillColor(245, 244, 240);
    doc.rect(M, yy, contentW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(JADE[0], JADE[1], JADE[2]);
    doc.text("DESCRIPTION", xDesc + 6, yy + 14);
    doc.text("QTY", xQty + colQty / 2, yy + 14, { align: "center" });
    doc.text("UNIT PRICE", xUnit + colUnit - 4, yy + 14, { align: "right" });
    doc.text(`AMOUNT (${args.currency})`, rowRight - 4, yy + 14, { align: "right" });
  };

  drawHeaderRow(y);
  y += 28;

  // body rows
  doc.setTextColor(FG[0], FG[1], FG[2]);
  args.lines.forEach((line, idx) => {
    const editionLabel = line.edition ? `Edition: ${line.edition}` : null;
    const meta = [line.dimensions, line.materials, editionLabel, line.leadTime, line.notes].filter(Boolean) as string[];
    const titleWrap = doc.splitTextToSize(line.productName || "—", colDesc - 12);
    // Pre-wrap meta strings so multi-line materials/notes are not truncated.
    const metaWrapped = meta.map((m) => doc.splitTextToSize(m, colDesc - 12) as string[]);
    const metaLineCount = metaWrapped.reduce((sum, w) => sum + w.length, 0);
    const metaHeight = metaLineCount * 10;
    const titleHeight = titleWrap.length * 12;
    const rowH = Math.max(56, 12 /* brand */ + titleHeight + metaHeight + 14);

    // page break
    if (y + rowH > pageH - 90) {
      doc.addPage();
      y = 60;
      drawHeaderRow(y);
      y += 28;
      doc.setTextColor(FG[0], FG[1], FG[2]);
    }

    // image thumbnail (left)
    const img = images[idx];
    if (img) {
      try {
        const thumb = 48;
        const thumbY = y + 4;
        // square crop is already done by Cloudinary transform — draw centered
        doc.addImage(img.data, "JPEG", xImg + 2, thumbY, thumb, thumb);
      } catch {
        /* ignore */
      }
    } else {
      // placeholder block
      doc.setFillColor(248, 247, 243);
      doc.rect(xImg + 2, y + 4, 48, 48, "F");
    }

    // brand
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const brand = (line.brandName || "").includes(" - ")
      ? line.brandName.split(" - ")[0].trim()
      : (line.brandName || "");
    if (brand) doc.text(brand.toUpperCase(), xDesc + 6, y + 8);

    // title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(titleWrap, xDesc + 6, y + 20);

    // meta lines (full wrap, no truncation)
    let metaY = y + 20 + titleHeight + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    metaWrapped.forEach((wrapped) => {
      wrapped.forEach((ln) => {
        doc.text(ln, xDesc + 6, metaY);
        metaY += 10;
      });
    });

    // qty / unit / amount
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(String(line.quantity), xQty + colQty / 2, y + 20, { align: "center" });
    doc.text(fmtMoney(line.unitPriceCents, args.currency), xUnit + colUnit - 4, y + 20, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmtMoney(line.lineTotalCents, args.currency), rowRight - 4, y + 20, { align: "right" });

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
      value: `- ${fmtMoney(discountCents, args.currency)}`,
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
    doc.text(r.value, x + blockW - 14, cy, { align: "right" });
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
  doc.text(fmtMoney(grand, args.currency), x + blockW - 14, cy, { align: "right" });
  cy += 18;

  // deposit / balance
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("60% deposit due now", x + 14, cy);
  doc.text(fmtMoney(deposit, args.currency), x + blockW - 14, cy, { align: "right" });
  cy += 14;
  doc.text("40% balance before shipment", x + 14, cy);
  doc.text(fmtMoney(balance, args.currency), x + blockW - 14, cy, { align: "right" });

  return y + totalH + 12;
}

// -------- UK Landed Cost block (GBP DDP London) -------------------------
function drawGbpLandedBlock(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  const g = args.gbpLanded!;
  const fmtG = (cents: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format((cents || 0) / 100);

  const blockW = 280;
  const x = M + contentW - blockW;
  let cy = y;

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: "Goods (after discount)", value: fmtG(g.goodsGbpCents) });
  rows.push({ label: "Shipping FR to GB", value: fmtG(g.shippingGbpCents) });
  if (g.dutyGbpCents > 0) rows.push({ label: "Import duty", value: fmtG(g.dutyGbpCents) });
  if (g.vatGbpCents > 0) rows.push({ label: "UK VAT", value: fmtG(g.vatGbpCents) });

  const rowH = 16;
  const fxNote = `Indicative. EUR-GBP @ ${g.fxEurGbp?.toFixed(4) ?? "-"} (+2% FX buffer). DDP - UK customs, duty & VAT included. Payments & deposits remain in ${args.currency}.`;
  const fxLines = doc.splitTextToSize(fxNote, blockW - 28);
  const fallbackLines = g.fxIsFallback
    ? doc.splitTextToSize("Live FX unavailable - figures use a fallback indicative rate. Treat the GBP total as approximate.", blockW - 28)
    : [];
  const totalH = 28 + rows.length * rowH + 28 + fxLines.length * 10 + fallbackLines.length * 10 + 14;

  doc.setFillColor(250, 249, 246);
  doc.rect(x, cy, blockW, totalH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("UK LANDED COST · GBP DDP LONDON", x + 14, cy + 14);
  cy += 28;

  rows.forEach((r) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(r.label, x + 14, cy);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(r.value, x + blockW - 14, cy, { align: "right" });
    cy += rowH;
  });

  doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
  doc.setLineWidth(0.6);
  doc.line(x + 14, cy - 2, x + blockW - 14, cy - 2);
  cy += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("Total GBP · DDP London", x + 14, cy);
  doc.text(fmtG(g.totalGbpCents), x + blockW - 14, cy, { align: "right" });
  cy += 14;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  fxLines.forEach((ln: string) => { doc.text(ln, x + 14, cy); cy += 9; });
  if (fallbackLines.length) {
    doc.setTextColor(178, 100, 30);
    fallbackLines.forEach((ln: string) => { doc.text(ln, x + 14, cy); cy += 9; });
  }

  return y + totalH + 12;
}

// -------- Insurance block -----------------------------------------------
function drawInsuranceBlock(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  sectionTitle(doc, "Coverage & insurance", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  const intro = "Bundled transit & all-risk coverage with this quote. Premium is calculated on net value after trade discount.";
  const introWrap = doc.splitTextToSize(intro, contentW);
  doc.text(introWrap, M, y);
  y += introWrap.length * 11 + 6;

  // Tier descriptions table
  const tiers = [
    { label: "Standard transit", rate: "0.50%", desc: "Loss & damage in transit. Door-to-door coverage." },
    { label: "Premium transit", rate: "1.00%", desc: "Adds handling, storage in-transit, partial loss." },
    { label: "All-risk fine art", rate: "1.80%", desc: "Comprehensive incl. installation, storage 30 days, named perils." },
  ];
  const colW = contentW / 3;
  tiers.forEach((t, i) => {
    const x = M + i * colW;
    const isSelected = args.insuranceLabel && t.label.toLowerCase().includes(args.insuranceLabel.toLowerCase().split(" ")[0]);
    if (isSelected) {
      doc.setFillColor(245, 244, 240);
      doc.rect(x, y - 2, colW - 8, 56, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(JADE[0], JADE[1], JADE[2]);
    doc.text(t.label.toUpperCase(), x + 6, y + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(t.rate, x + 6, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const w = doc.splitTextToSize(t.desc, colW - 14);
    doc.text(w, x + 6, y + 36);
  });
  y += 64;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const note = "Indicative premiums underwritten by Maison Affluency partner brokers. Final certificate issued upon order confirmation.";
  const w = doc.splitTextToSize(note, contentW);
  doc.text(w, M, y);
  y += w.length * 10;
  return y;
}

// -------- Payment terms + bank ------------------------------------------
function drawPaymentTerms(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
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

  y += 10;
  // Bank box
  const boxH = 78;
  doc.setFillColor(250, 249, 246);
  doc.rect(M, y, contentW, boxH, "F");
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.4);
  doc.rect(M, y, contentW, boxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("PAYMENT BY BANK TRANSFER TO", M + 12, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("AFFLUENCY ETC PTE LTD", M + 12, y + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1 Grange Garden, #16-05, Singapore, 249631", M + 12, y + 44);

  // right column: bank IBAN
  const rightX = M + contentW / 2 + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("IBAN: LT73 3250 0692 1856 8740", rightX, y + 30);
  doc.text("BIC: REVOLT21", rightX, y + 44);
  doc.text("Bank: Revolut Bank UAB", rightX, y + 58);

  return y + boxH;
}

// -------- Terms & Conditions --------------------------------------------
function drawTermsAndConditions(doc: jsPDF, M: number, y: number, contentW: number): number {
  sectionTitle(doc, "Terms & conditions", M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const t = "The terms and conditions will be given separately and shall apply to the quotation given for the supply of any items detailed herein. Please read carefully.";
  const w = doc.splitTextToSize(t, contentW);
  doc.text(w, M, y);
  return y + w.length * 11;
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

function ensureSpace(doc: jsPDF, y: number, needed: number, pageH: number): number {
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
export async function downloadQuotePdf(args: QuotePdfArgs) {
  const doc = await buildQuotePdf(args);
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
