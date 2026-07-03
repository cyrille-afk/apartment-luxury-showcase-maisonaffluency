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
import { appendHkDapPage, type HkDapPageArgs } from "@/lib/hkDapPdf";
import { appendUkDdpPage, type UkDdpPageArgs } from "@/lib/ukDdpPdf";

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
  variantLabel?: string | null;
  /** Formatted upholstery fabric line (e.g. "Fabric: ADA 08 Naturel · CAT B — +€300 (3 m)"). Rendered on its own meta line under Finish. */
  fabricLabel?: string | null;
  /** Formatted wood finish line (e.g. "Wood finish: Walnut"). */
  woodFinishLabel?: string | null;
  leadTime?: string | null;
  notes?: string | null;
  quantity: number;
  unitPriceCents: number | null;     // already in quote currency
  lineTotalCents: number | null;     // already in quote currency
  /** Optional: unit price in the item's source currency (e.g. EUR catalog
   *  price). When set, the PDF renders UNIT PRICE in the source currency
   *  and keeps AMOUNT in the display currency so the trade user can audit
   *  the FX conversion at a glance. */
  sourceUnitPriceCents?: number | null;
  sourceCurrency?: string | null;
  imageUrl?: string | null;          // optional product thumbnail
  finishSwatchUrl?: string | null;
  fabricSwatchUrl?: string | null;
  shipOriginCountry?: string | null;
  shipMode?: string | null;
  shipCbm?: number | null;
  shipWeightKg?: number | null;
}

export interface QuotePdfArgs {
  quoteNumber: string;
  status: string;                    // raw status, e.g. "priced"
  statusLabel: string;               // human label, e.g. "Priced"
  createdAt: Date;
  expiryAt: Date;
  clientName?: string | null;
  /** Optional structured client billing — used when a client_id is linked. Falls back to clientName. */
  clientCompany?: string | null;
  clientBilling?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  clientContact?: {
    name?: string | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  projectName?: string | null;
  currency: string;                  // SGD | USD | EUR | GBP
  lines: QuotePdfLine[];
  subtotalCents: number;
  tradeDiscountPct: number;          // 0..1 (e.g. 0.08)
  tradeDiscountApplied: boolean;
  /** Active tier label (e.g. "Silver"). When provided, shown in the discount row + ladder. */
  tierLabel?: string | null;
  /** Tier ladder rendered under totals so the client understands why this rate applied. */
  tierBreakdown?: Array<{ label: string; pct: number; minSpendCents: number; active: boolean }>;
  gstEnabled: boolean;
  gstRate: number;                   // percent
  insurancePremiumCents?: number;
  /** Freight estimate in quote currency; included in Order total and 60/40 split. */
  shippingEstimateCents?: number;
  shippingShipmentCount?: number;
  /** When all shipments share a single mode, the totals row reflects it
   *  (e.g. "Air freight estimate", "Sea LCL estimate"). Falls back to
   *  "Shipping estimate" when mixed or unknown. */
  shippingModeLabel?: string | null;
  /** When a quote consolidates multiple shipping modes (e.g. air + sea),
   *  this breaks the shipping estimate down per mode in the totals block. */
  shippingModeBreakdown?: Array<{
    modeLabel: string;
    cents: number;
    shipmentCount: number;
  }>;
  insuranceLabel?: string | null;
  insuranceRateBps?: number;
  insuranceEnabled?: boolean;
  /** Additional fixed charges (crating, hand-loading, surcharges) from
   *  trade_quote_extras. Rendered as muted "+ amount" lines just before the
   *  shipping estimate and folded into the Order total. */
  extras?: Array<{ label: string; amountCents: number }>;
  notes?: string | null;
  /** Optional ship-to block (only rendered when shipToSameAsBill === false). */
  shipToSameAsBill?: boolean;
  incoterm?: string | null;
  shipTo?: {
    name?: string | null;
    attention?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  } | null;
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
    /** Per-origin breakdown so the PDF can show shipping mode (air/sea/etc.) per consolidation. */
    origins?: { country: string; modeLabel: string; gbpCents: number }[];
  } | null;
  /** Optional HK Landed Cost (HKD DAP Hong Kong) breakdown — rendered after the GBP block when provided. */
  hkdLanded?: {
    ready: boolean;
    fxEurHkd: number | null;
    fxIsFallback: boolean;
    goodsHkdCents: number;
    shippingHkdCents: number;
    dutyHkdCents: number;
    vatHkdCents: number;
    totalHkdCents: number;
    goodsEurCents?: number;
    shippingEurCents?: number;
    totalEurCents?: number;
    /** Per-origin breakdown so the PDF can show shipping mode (air/sea/etc.) per consolidation. */
    origins?: { country: string; modeLabel: string; hkdCents: number; eurCents: number }[];
  } | null;
  /** Full HK DAP estimate appended as a dedicated final page when provided. */
  hkDapPage?: HkDapPageArgs | null;
  /** Full UK DDP estimate appended as a dedicated final page when provided. */
  ukDdpPage?: UkDdpPageArgs | null;
  /** Weighted deposit fraction (0..1). Defaults to 0.6. When 1, balance row is hidden. */
  depositPct?: number;
  /** Document kind — drives the header title. Defaults to "quote". */
  documentKind?: "quote" | "tax_invoice" | "proforma_net_buy";
  /** Render a "FOR RESALE — NOT FOR RESALE TO END CONSUMERS" notice on page 1 (net_buy). */
  forResaleNotice?: boolean;
  /** Resale certificate reference shown in the meta block (net_buy, US). */
  resaleCertNumber?: string | null;
  /** FX snapshot used to convert source-currency line prices into the quote
   *  currency. When provided, the PDF renders a compliance line under the
   *  totals block: "FX applied {date} — EUR→SGD 1.4762, USD→SGD 1.34". */
  fxSnapshot?: {
    appliedAt: Date;
    pairs: Array<{ src: string; tgt: string; rate: number; source?: string | null }>;
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6_000);
    const res = await fetch(optimized, { mode: "cors", signal: controller.signal });
    window.clearTimeout(timeout);
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

  // Pre-fetch logo + product/finish swatch images in parallel (best-effort)
  const [logo, ...lineImages] = await Promise.all([
    fetchImageDataUrl(affluencyLogoUrl),
    ...args.lines.flatMap((l) => [
      l.imageUrl ? fetchImageDataUrl(l.imageUrl) : Promise.resolve(null),
      l.finishSwatchUrl ? fetchImageDataUrl(l.finishSwatchUrl) : Promise.resolve(null),
      l.fabricSwatchUrl ? fetchImageDataUrl(l.fabricSwatchUrl) : Promise.resolve(null),
    ]),
  ]);
  const productImages = args.lines.map((_, idx) => lineImages[idx * 3] ?? null);
  const finishSwatchImages = args.lines.map((_, idx) => lineImages[idx * 3 + 1] ?? null);
  const fabricSwatchImages = args.lines.map((_, idx) => lineImages[idx * 3 + 2] ?? null);

  drawHeader(doc, args, pageW, M, logo);

  let y = 168;

  // FOR-RESALE notice (net_buy only) — small stamp under the header.
  if (args.forResaleNotice) {
    doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
    doc.setLineWidth(0.6);
    doc.setFillColor(245, 248, 246);
    doc.roundedRect(M, y - 4, contentW, 30, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(JADE[0], JADE[1], JADE[2]);
    doc.text("FOR RESALE — NOT FOR RESALE TO END CONSUMERS", M + 12, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const certLine = args.resaleCertNumber
      ? `Sold to designer firm for resale. Resale certificate on file: ${args.resaleCertNumber}.`
      : "Sold to designer firm for resale under verified resale certificate on file.";
    doc.text(certLine, M + 12, y + 21);
    y += 40;
  }

  // ---- Company address block (left) + meta (right)
  y = drawCompanyAndMeta(doc, args, M, y, contentW);

  // ---- Line items table (with thumbnails)
  y = drawTable(doc, args, M, y, contentW, pageH, productImages, finishSwatchImages, fabricSwatchImages);

  // ---- Totals block (right aligned)
  y = ensureSpace(doc, y, 220, pageH);
  y = drawTotals(doc, args, M, y, contentW);

  // ---- FX audit line (compliance) — shown whenever a snapshot was passed,
  //      even if all rates are identity, so the client sees a timestamped
  //      reference for any conversion applied to their unit prices.
  if (args.fxSnapshot && args.fxSnapshot.pairs.length > 0) {
    const fxLine = formatFxSnapshotLine(args.fxSnapshot);
    y = ensureSpace(doc, y, 26, pageH);
    y += 10;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const wrappedFx = doc.splitTextToSize(fxLine, contentW);
    wrappedFx.forEach((ln: string) => { doc.text(ln, M, y); y += 10; });
    doc.setTextColor(FG[0], FG[1], FG[2]);
  }


  // ---- Trade Tiers ladder — separate card, explains the discount rate
  if (args.tradeDiscountApplied && args.tierBreakdown && args.tierBreakdown.length > 0) {
    const need = 30 + args.tierBreakdown.length * 13;
    y = ensureSpace(doc, y, need, pageH);
    y = drawTierBlock(doc, args, M, y, contentW);
  }

  // ---- UK Landed Cost (GBP DDP London) — inline summary only when a full
  //      dedicated UK DDP page isn't being appended at the end.
  if (!args.ukDdpPage && args.gbpLanded && args.gbpLanded.ready && args.gbpLanded.totalGbpCents > 0) {
    y = ensureSpace(doc, y, 150, pageH);
    y += 12;
    y = drawGbpLandedBlock(doc, args, M, y, contentW);
  }

  // ---- HK Landed Cost (HKD DAP Hong Kong) — inline summary only when a full
  //      dedicated HK DAP page isn't being appended at the end.
  if (!args.hkDapPage && args.hkdLanded && args.hkdLanded.ready && args.hkdLanded.totalHkdCents > 0) {
    y = ensureSpace(doc, y, 150, pageH);
    y += 12;
    y = drawHkdLandedBlock(doc, args, M, y, contentW);
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

  // ---- Footer on every quote page (before appending landed-cost annexes,
  //      which carry their own self-contained footer).
  const mainPagesCount = doc.getNumberOfPages();
  drawFooterPages(doc, args, pageW, pageH, M, 1, mainPagesCount);

  // ---- Appended landed-cost annexes (each on its own fresh page)
  if (args.ukDdpPage) {
    appendUkDdpPage(doc, args.ukDdpPage);
  }
  if (args.hkDapPage) {
    appendHkDapPage(doc, args.hkDapPage);
  }

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
  doc.text("Curated furniture, lighting and objects for trade", textX, 72);
  doc.text("Affluency Etc Pte. Ltd. - Singapore", textX, 86);

  // Right side: doc title + ref
  const title =
    args.documentKind === "tax_invoice" ? "TAX INVOICE"
    : args.documentKind === "proforma_net_buy" ? "PROFORMA INVOICE"
    : "QUOTE";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(title.length > 6 ? 16 : 20);
  doc.text(title, pageW - M, 50, { align: "right" });

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
  // Split CLIENT into person + company on common separators so they render on
  // two distinct lines (e.g. "Margot Watson — De Beers London").
  const splitClient = (raw: string | null | undefined): string[] => {
    const v = String(raw ?? "").trim();
    if (!v) return ["—"];
    const m = v.split(/\s+[—–\-/|]\s+|\s*,\s*/);
    return m.filter(Boolean).slice(0, 2);
  };
  // When we have structured company info, the CLIENT field shows ONLY the
  // company (the contact is rendered in its own CONTACT panel below to avoid
  // duplication). Falls back to legacy clientName parsing otherwise.
  const company = (args.clientCompany ?? "").trim();
  let clientLines: string[];
  if (company) {
    clientLines = [company];
  } else {
    clientLines = splitClient(args.clientName);
  }
  const metaRows = [
    [["DATE", fmtDate(args.createdAt)], ["EXPIRY", fmtDate(args.expiryAt)]],
    [["CLIENT", clientLines], ["PROJECT", [args.projectName || "—"]]],
  ] as Array<Array<[string, string[] | string]>>;
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
      const values = Array.isArray(value) ? value : [value];
      const lines: string[] = [];
      values.forEach((v) => {
        const wrapped = doc.splitTextToSize(String(v), metaColW - 8);
        wrapped.forEach((w: string) => lines.push(w));
      });
      lines.slice(0, 2).forEach((ln: string, i: number) => {
        doc.text(ln, x, ry + 12 + i * 10);
      });
    });
  });

  let yEnd = y + 70;

  // ---- Optional BILL TO panel: full billing address (left) + contact details (right)
  const b = args.clientBilling || {};
  const c = args.clientContact || {};
  const addr: string[] = [];
  if (b.line1) addr.push(b.line1);
  if (b.line2) addr.push(b.line2);
  const cityRegion = [b.city, b.region].filter(Boolean).join(", ");
  const cityLine = [cityRegion, b.postalCode].filter(Boolean).join(" ");
  if (cityLine) addr.push(cityLine);
  if (b.country) addr.push(b.country);

  const cName = (c.name || "").trim();
  const cRole = (c.role || "").trim();
  const cEmail = (c.email || "").trim();
  const cPhone = (c.phone || "").trim();
  const hasContact = !!(cName || cRole || cEmail || cPhone);

  if (addr.length > 0 || hasContact) {
    const py = yEnd + 4;
    doc.setDrawColor(230, 228, 222);
    doc.setLineWidth(0.4);
    doc.line(M, py, M + contentW, py);
    const pyt = py + 14;
    // Left: bill to
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("BILL TO", M, pyt);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    const billHeader = company || (clientLines[clientLines.length - 1] ?? "");
    let lyL = pyt + 12;
    if (billHeader) {
      doc.setFont("helvetica", "bold");
      doc.text(doc.splitTextToSize(billHeader, colW - 8), M, lyL);
      lyL += 11;
      doc.setFont("helvetica", "normal");
    }
    addr.forEach((ln) => {
      const w = doc.splitTextToSize(ln, colW - 8);
      doc.text(w, M, lyL);
      lyL += w.length * 11;
    });
    // Right: contact — each field on its own line, name bold, role muted
    if (hasContact) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("CONTACT", metaX, pyt);
      let lyR = pyt + 12;
      const colWR = colW - 8;
      if (cName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(FG[0], FG[1], FG[2]);
        const w = doc.splitTextToSize(cName, colWR);
        doc.text(w, metaX, lyR);
        lyR += w.length * 12;
      }
      if (cRole) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        const w = doc.splitTextToSize(cRole, colWR);
        doc.text(w, metaX, lyR);
        lyR += w.length * 11;
      }
      if (cEmail || cPhone) lyR += 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      if (cEmail) {
        const w = doc.splitTextToSize(cEmail, colWR);
        doc.text(w, metaX, lyR);
        lyR += w.length * 11;
      }
      if (cPhone) {
        const w = doc.splitTextToSize(cPhone, colWR);
        doc.text(w, metaX, lyR);
        lyR += w.length * 11;
      }
      lyL = Math.max(lyL, lyR);
    }
    yEnd = lyL + 6;
  }

  // ---- Optional SHIP TO panel — only when ship-to differs from bill-to
  const s = args.shipTo || {};
  const shipDifferent = args.shipToSameAsBill === false;
  const shipAddr: string[] = [];
  if (s.address1) shipAddr.push(s.address1);
  if (s.address2) shipAddr.push(s.address2);
  const sCityRegion = [s.city, s.state].filter(Boolean).join(", ");
  const sCityLine = [sCityRegion, s.postalCode].filter(Boolean).join(" ");
  if (sCityLine) shipAddr.push(sCityLine);
  if (s.country) shipAddr.push(s.country);
  const shipHasAny = shipDifferent && (
    shipAddr.length > 0 || s.name || s.attention || s.phone || s.email || s.notes || args.incoterm
  );
  if (shipHasAny) {
    const py = yEnd + 4;
    doc.setDrawColor(230, 228, 222);
    doc.setLineWidth(0.4);
    doc.line(M, py, M + contentW, py);
    const pyt = py + 14;
    // Header row: SHIP TO (left) — INCOTERM pill (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("SHIP TO", M, pyt);
    if (args.incoterm) {
      const label = `INCOTERM · ${args.incoterm}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const pillW = doc.getTextWidth(label) + 14;
      const pillX = M + contentW - pillW;
      doc.setFillColor(JADE[0], JADE[1], JADE[2]);
      doc.roundedRect(pillX, pyt - 10, pillW, 14, 7, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(label, pillX + pillW / 2, pyt, { align: "center" });
      doc.setTextColor(FG[0], FG[1], FG[2]);
    }
    // Body — two columns: address (left) + contact / notes (right)
    const colW2 = contentW / 2;
    const metaX2 = M + colW2;
    let lyL2 = pyt + 14;
    const headerName = (s.name || "").trim() || (args.clientCompany || "").trim();
    if (headerName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      doc.text(doc.splitTextToSize(headerName, colW2 - 8), M, lyL2);
      lyL2 += 11;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    shipAddr.forEach((ln) => {
      const w = doc.splitTextToSize(ln, colW2 - 8);
      doc.text(w, M, lyL2);
      lyL2 += w.length * 11;
    });
    // Right column: attention / phone / email / notes
    let lyR2 = pyt + 14;
    const colWR2 = colW2 - 8;
    if (s.attention) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("ATTENTION", metaX2, lyR2);
      lyR2 += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      const w = doc.splitTextToSize(s.attention, colWR2);
      doc.text(w, metaX2, lyR2);
      lyR2 += w.length * 11 + 2;
    }
    if (s.phone) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      doc.text(doc.splitTextToSize(s.phone, colWR2), metaX2, lyR2);
      lyR2 += 11;
    }
    if (s.email) {
      doc.text(doc.splitTextToSize(s.email, colWR2), metaX2, lyR2);
      lyR2 += 11;
    }
    if (s.notes) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const w = doc.splitTextToSize(s.notes, colWR2);
      doc.text(w, metaX2, lyR2);
      lyR2 += w.length * 10;
    }
    yEnd = Math.max(lyL2, lyR2) + 6;
  }

  return yEnd;
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
  finishSwatches: (Awaited<ReturnType<typeof fetchImageDataUrl>>)[],
  fabricSwatches: (Awaited<ReturnType<typeof fetchImageDataUrl>>)[],
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
    const editionRaw = (line.edition ?? "").trim();
    const editionClean = editionRaw.replace(/^edition\s*[:\-—]?\s*/i, "").trim();
    const editionLabel = editionClean ? `Edition: ${editionClean}` : null;
    const variantLabel = line.variantLabel ? `Finish: ${line.variantLabel}` : null;
    // When the user picked a finish, it supersedes the generic catalogue
    // materials line (which is otherwise repetitive noise). Dimensions remain
    // visible unless they are already embedded in the variant label.
    // When a finish/variant is chosen the customer has picked a specific size;
    // the catalogue's multi-size dimensions string becomes noise. Suppress it
    // whenever the variant label already carries dimensional tokens
    // (cm / mm / × / Ø), regardless of whether the two strings share a prefix.
    const variantHasDims = !!(line.variantLabel && /(\d\s*(cm|mm)\b|[×xX]\s*\d|Ø)/.test(line.variantLabel));
    const dimsAlreadyInVariant = variantHasDims || !!(line.variantLabel && line.dimensions &&
      line.variantLabel.toLowerCase().includes(String(line.dimensions).toLowerCase().slice(0, 8)));
    const showMaterials = !line.variantLabel;
    const meta = [
      variantLabel,
      line.fabricLabel ?? null,
      line.woodFinishLabel ?? null,
      dimsAlreadyInVariant ? null : line.dimensions,
      showMaterials ? line.materials : null,
      editionLabel,
      line.leadTime,
      line.shipOriginCountry || line.shipMode || line.shipCbm || line.shipWeightKg
        ? `Shipping: ${line.shipOriginCountry || "origin TBC"}${line.shipMode ? ` · ${line.shipMode.replace("_", " ").toUpperCase()}` : ""}${line.shipCbm ? ` · ${line.shipCbm} CBM/unit` : ""}${line.shipWeightKg ? ` · ${line.shipWeightKg} kg/unit` : ""}`
        : null,
      line.notes,
    ].filter(Boolean) as string[];
    const titleWrap = doc.splitTextToSize(line.productName || "—", colDesc - 12);
    // Pre-wrap meta strings so multi-line materials/notes are not truncated.
    const metaWrapped = meta.map((m) => doc.splitTextToSize(m, colDesc - 12) as string[]);
    const metaLineCount = metaWrapped.reduce((sum, w) => sum + w.length, 0);
    const metaHeight = metaLineCount * 10;
    const titleHeight = titleWrap.length * 12;
    const hasSwatches = !!(finishSwatches[idx] || fabricSwatches[idx]);
    const rowH = Math.max(hasSwatches ? 90 : 56, 12 /* brand */ + titleHeight + metaHeight + 14);

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

    const swatches = [finishSwatches[idx], fabricSwatches[idx]].filter(Boolean) as NonNullable<Awaited<ReturnType<typeof fetchImageDataUrl>>>[];
    swatches.slice(0, 2).forEach((swatch, swatchIdx) => {
      try {
        const size = 20;
        const sx = xImg + 2 + swatchIdx * 24;
        const sy = y + 58;
        doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
        doc.setLineWidth(0.25);
        doc.rect(sx, sy, size, size);
        doc.addImage(swatch.data, "JPEG", sx, sy, size, size);
      } catch {
        /* ignore swatch failures */
      }
    });

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
    {
      // Dual-currency display: when the line's source currency differs from
      // the quote currency, show the source-currency unit price (e.g.
      // "EUR 1,155.00") so the trade user can audit the FX conversion at
      // a glance. AMOUNT remains in the quote currency.
      const srcCcy = (line.sourceCurrency || "").toUpperCase();
      const showSource =
        srcCcy &&
        srcCcy !== args.currency.toUpperCase() &&
        line.sourceUnitPriceCents != null;
      if (showSource) {
        doc.text(
          fmtMoney(line.sourceUnitPriceCents!, srcCcy),
          xUnit + colUnit - 4,
          y + 20,
          { align: "right" },
        );
      } else {
        doc.text(fmtMoney(line.unitPriceCents, args.currency), xUnit + colUnit - 4, y + 20, { align: "right" });
      }
    }
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
  // Additional charges (crating, hand-loading, surcharges) are NOT discountable.
  // They render as full lines after the Net subtotal / before shipping.
  const extrasList = (args.extras || []).filter((e) => (e?.amountCents || 0) !== 0);
  const extrasTotalCents = extrasList.reduce((s, e) => s + (e.amountCents || 0), 0);
  rows.push({ label: "Subtotal", value: fmtMoney(args.subtotalCents, args.currency) });
  const discountCents = args.tradeDiscountApplied
    ? Math.round(args.subtotalCents * args.tradeDiscountPct)
    : 0;
  if (discountCents > 0) {
    const pctTxt = `${(args.tradeDiscountPct * 100).toFixed(args.tradeDiscountPct * 100 % 1 === 0 ? 0 : 1)}%`;
    rows.push({
      label: args.tierLabel
        ? `Trade discount — ${args.tierLabel} (${pctTxt})`
        : `Trade discount (${pctTxt})`,
      value: `- ${fmtMoney(discountCents, args.currency)}`,
      muted: true,
    });
  }
  const afterDiscount = args.subtotalCents - discountCents;
  if (discountCents > 0) {
    rows.push({ label: "Net subtotal", value: fmtMoney(afterDiscount, args.currency) });
  }
  // Additional charges (non-discountable) — rendered after Net subtotal as full lines.
  extrasList.forEach((e) => {
    rows.push({
      label: e.label || "Additional charge",
      value: `+ ${fmtMoney(e.amountCents, args.currency)}`,
    });
  });
  if ((args.insurancePremiumCents || 0) > 0) {
    rows.push({
      label: args.insuranceLabel
        ? `Insurance — ${args.insuranceLabel}${args.insuranceRateBps ? ` (${(args.insuranceRateBps / 100).toFixed(2)}%)` : ""}`
        : "Insurance",
      value: `+ ${fmtMoney(args.insurancePremiumCents!, args.currency)}`,
      muted: true,
    });
  }
  const baseForGst = afterDiscount + extrasTotalCents + (args.insurancePremiumCents || 0);
  const gstCents = args.gstEnabled ? Math.round(baseForGst * args.gstRate / 100) : 0;
  if (args.gstEnabled) {
    rows.push({
      label: `GST (${args.gstRate}%)`,
      value: `+ ${fmtMoney(gstCents, args.currency)}`,
      muted: true,
    });
  }
  const shippingEstimateCents = Math.max(0, Math.round(args.shippingEstimateCents || 0));
  if (shippingEstimateCents > 0) {
    const baseLabel = args.shippingModeLabel
      ? `${args.shippingModeLabel} estimate`
      : "Shipping estimate";
    rows.push({
      label: `${baseLabel}${args.shippingShipmentCount && args.shippingShipmentCount > 1 ? ` (${args.shippingShipmentCount} shipments)` : ""}`,
      value: `+ ${fmtMoney(shippingEstimateCents, args.currency)}`,
      muted: true,
    });
    // Per-mode breakdown — only when the quote mixes multiple modes.
    if (
      !args.shippingModeLabel &&
      args.shippingModeBreakdown &&
      args.shippingModeBreakdown.length > 1
    ) {
      args.shippingModeBreakdown.forEach((m) => {
        rows.push({
          label: `   · ${m.modeLabel}${m.shipmentCount > 1 ? ` (${m.shipmentCount} shipments)` : ""}`,
          value: fmtMoney(m.cents, args.currency),
          muted: true,
        });
      });
    }
  }
  const grand = baseForGst + gstCents + shippingEstimateCents;
  const depositPct = Math.max(0, Math.min(1, args.depositPct ?? 0.6));
  const deposit = Math.round(grand * depositPct);
  const balance = grand - deposit;
  const depositPctLabel = `${Math.round(depositPct * 100)}%`;
  const balancePctLabel = `${Math.round((1 - depositPct) * 100)}%`;
  const showBalanceRow = balance > 0;

  const rowH = 18;
  const disclaimer = shippingEstimateCents > 0 && showBalanceRow
    ? "Shipping & FX are estimates. Freight is re-quoted around 2 weeks before delivery using live carrier rates and FX; any variance is settled with the balance invoice."
    : "";
  const disclaimerLines = disclaimer ? doc.splitTextToSize(disclaimer, blockW - 28) : [];
  const totalH = rows.length * rowH + 80 + disclaimerLines.length * 9 + (disclaimerLines.length ? 10 : 0) - (showBalanceRow ? 0 : 14);
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
  doc.text(`${depositPctLabel} deposit due now`, x + 14, cy);
  doc.text(fmtMoney(deposit, args.currency), x + blockW - 14, cy, { align: "right" });
  cy += 14;
  if (showBalanceRow) {
    doc.text(`${balancePctLabel} balance before shipment`, x + 14, cy);
    doc.text(fmtMoney(balance, args.currency), x + blockW - 14, cy, { align: "right" });
    cy += 16;
  } else {
    cy += 2;
  }

  if (disclaimerLines.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    disclaimerLines.forEach((ln: string) => { doc.text(ln, x + 14, cy); cy += 9; });
  }

  return y + totalH + 12;
}

// -------- Trade Tiers block — separate card explaining the discount ladder ---
function drawTierBlock(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  if (!args.tradeDiscountApplied || !args.tierBreakdown || args.tierBreakdown.length === 0) return y;

  const blockW = 280;
  const x = M + contentW - blockW;
  const padTop = 14;
  const headerH = 18;
  const rowH = 13;
  const padBottom = 12;
  const blockH = padTop + headerH + (args.tierBreakdown.length * rowH) + padBottom;

  doc.setFillColor(250, 249, 246);
  doc.rect(x, y, blockW, blockH, "F");

  let cy = y + padTop + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("TRADE TIERS", x + 14, cy);
  cy += 6;

  doc.setDrawColor(220, 218, 210);
  doc.setLineWidth(0.3);
  doc.line(x + 14, cy, x + blockW - 14, cy);
  cy += 12;

  doc.setFontSize(8);
  args.tierBreakdown.forEach((t) => {
    const pctTxt = `${(t.pct * 100).toFixed(t.pct * 100 % 1 === 0 ? 0 : 1)}%`;
    const minTxt = t.minSpendCents > 0
      ? `from ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(t.minSpendCents / 100)} ${args.currency}`
      : "entry";
    const left = `${t.label}${t.active ? "  • current" : ""}`;
    const right = `${pctTxt} · ${minTxt}`;
    if (t.active) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(JADE[0], JADE[1], JADE[2]);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    }
    doc.text(left, x + 14, cy);
    doc.text(right, x + blockW - 14, cy, { align: "right" });
    cy += rowH;
  });

  return y + blockH + 12;
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
  if (g.origins && g.origins.length) {
    g.origins.forEach((o) => {
      rows.push({
        label: `Shipping ${o.country || "?"} \u2192 GB \u00B7 ${o.modeLabel}`,
        value: fmtG(o.gbpCents),
      });
    });
  } else {
    rows.push({ label: "Shipping to GB", value: fmtG(g.shippingGbpCents) });
  }
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
  doc.text("UK LANDED COST \u00B7 GBP DDP LONDON", x + 14, cy + 14);
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

// -------- HK Landed Cost block (HKD DAP Hong Kong) ----------------------
function drawHkdLandedBlock(doc: jsPDF, args: QuotePdfArgs, M: number, y: number, contentW: number): number {
  const h = args.hkdLanded!;
  const fmtH = (cents: number) =>
    new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
  const fmtE = (cents: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format((cents || 0) / 100);

  const blockW = 280;
  const x = M + contentW - blockW;
  let cy = y;

  // Each row carries its own height: rows with an EUR sub-line use two visual lines so the
  // EUR equivalent never overlaps the HKD value. Avoid the U+2248 (≈) glyph — jsPDF's default
  // helvetica encoding mangles it into garbage like `"H`. Use a plain ASCII `~` instead.
  type Row = { label: string; value: string; eur?: string };
  const rows: Row[] = [];
  rows.push({ label: "Goods (after discount)", value: fmtH(h.goodsHkdCents), eur: `~ ${fmtE(h.goodsEurCents)}` });
  if (h.origins && h.origins.length) {
    h.origins.forEach((o) => {
      rows.push({
        label: `Shipping ${o.country || "?"} \u2192 HK \u00B7 ${o.modeLabel}`,
        value: fmtH(o.hkdCents),
        eur: `~ ${fmtE(o.eurCents)}`,
      });
    });
  } else {
    rows.push({ label: "Shipping to HK", value: fmtH(h.shippingHkdCents), eur: `~ ${fmtE(h.shippingEurCents)}` });
  }
  if (h.dutyHkdCents > 0) rows.push({ label: "Import duty", value: fmtH(h.dutyHkdCents) });
  if (h.vatHkdCents > 0) rows.push({ label: "Sales tax / VAT", value: fmtH(h.vatHkdCents) });

  const rowH = 16;
  const eurSubH = 10; // extra vertical space for the EUR sub-line beneath HKD value
  const rowsH = rows.reduce((s, r) => s + rowH + (r.eur ? eurSubH : 0), 0);
  const fxNote = `Indicative. EUR-HKD @ ${h.fxEurHkd?.toFixed(4) ?? "-"} (+2% FX buffer). DAP - Hong Kong is a free port: 0% duty & 0% VAT. Payments & deposits remain in ${args.currency}.`;
  const fxLines = doc.splitTextToSize(fxNote, blockW - 28);
  const fallbackLines = h.fxIsFallback
    ? doc.splitTextToSize("Live FX unavailable - figures use a fallback indicative rate. Treat the HKD total as approximate.", blockW - 28)
    : [];
  const totalH = 28 + rowsH + 28 + fxLines.length * 10 + fallbackLines.length * 10 + 14;

  doc.setFillColor(250, 249, 246);
  doc.rect(x, cy, blockW, totalH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("HK LANDED COST \u00B7 HKD DAP HONG KONG", x + 14, cy + 14);
  cy += 28;

  rows.forEach((r) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(r.label, x + 14, cy);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(r.value, x + blockW - 14, cy, { align: "right" });
    cy += rowH;
    if (r.eur) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(r.eur, x + blockW - 14, cy - 4, { align: "right" });
      cy += eurSubH - 4;
    }
  });

  doc.setDrawColor(JADE[0], JADE[1], JADE[2]);
  doc.setLineWidth(0.6);
  doc.line(x + 14, cy - 2, x + blockW - 14, cy - 2);
  cy += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("Total HKD \u00B7 DAP Hong Kong", x + 14, cy);
  doc.text(fmtH(h.totalHkdCents), x + blockW - 14, cy, { align: "right" });
  cy += 11;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`~ ${fmtE(h.totalEurCents)}`, x + blockW - 14, cy, { align: "right" });
  cy += 6;


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
  const depositPct = Math.max(0, Math.min(1, args.depositPct ?? 0.6));
  const depositLabel = `${Math.round(depositPct * 100)}%`;
  const balanceLabel = `${Math.round((1 - depositPct) * 100)}%`;
  const isFullUpfront = depositPct >= 0.999;
  const terms = [
    isFullUpfront
      ? "100% payment is due on order confirmation (applies to in-stock items, or when the admin overrides the schedule). The order total includes the current shipping estimate."
      : `${depositLabel} deposit due on order confirmation; ${balanceLabel} balance due before shipment. Both instalments are calculated on the order total including the current shipping estimate.`,
    isFullUpfront
      ? "Shipping and FX shown are estimates at quote date and are locked in if payment is received within 7 days of issue. After that, freight is re-quoted at live carrier rates and FX before dispatch, and any variance is settled via a separate adjustment invoice."
      : "Shipping and FX are estimates at quote date and are locked in if the deposit is received within 7 days of issue. Otherwise, around 2 weeks before the end of the lead time, Maison Affluency re-quotes freight at live carrier rates and FX, then emails the balance invoice unless the admin overrides the schedule.",
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
  const boxH = 130;
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
  doc.text("AFFLUENCY ETC PTE LTD", M + 12, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("1 Grange Garden, #16-05, Singapore, 249631, Singapore", M + 12, y + 40);

  // Two columns: EUR (SEPA) | Global SWIFT
  const colW = (contentW - 24) / 2;
  const leftX = M + 12;
  const rightX = M + 12 + colW;
  const colY = y + 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(JADE[0], JADE[1], JADE[2]);
  doc.text("MAIN · EUR (SEPA)", leftX, colY);
  doc.text("GLOBAL · SWIFT (OUTSIDE EEA)", rightX, colY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("IBAN: LT73 3250 0692 1856 8740", leftX, colY + 12);
  doc.text("BIC: REVOLT21", leftX, colY + 24);
  doc.text("Bank: Revolut Bank UAB", leftX, colY + 36);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Konstitucijos ave. 21B, Vilnius, Lithuania", leftX, colY + 48);

  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.text("Account: 885111609218375", rightX, colY + 12);
  doc.text("SWIFT/BIC: REVOSGS2  ·  Intermediary: BARCDEFF", rightX, colY + 24);
  doc.text("Bank: Revolut Technologies Singapore Pte. Ltd", rightX, colY + 36);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("6 Battery Road, Floor 6-01, 049909, Singapore", rightX, colY + 48);

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

function drawFooterPages(
  doc: jsPDF,
  args: QuotePdfArgs,
  pageW: number,
  pageH: number,
  M: number,
  fromPage: number,
  toPage: number,
) {
  const total = toPage - fromPage + 1;
  for (let p = fromPage; p <= toPage; p++) {
    const idx = p - fromPage + 1;
    doc.setPage(p);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.4);
    doc.line(M, pageH - 56, pageW - M, pageH - 56);
    doc.setTextColor(JADE_SOFT[0], JADE_SOFT[1], JADE_SOFT[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Maison Affluency - hello@maisonaffluency.com - maisonaffluency.com", M, pageH - 38);
    doc.text(
      `${args.quoteNumber} - ${args.statusLabel} - Page ${idx} of ${total}`,
      pageW - M,
      pageH - 38,
      { align: "right" },
    );
  }
}

/** Slugify a client name into a filesystem-safe PascalCase token. */
function slugifyClient(name?: string | null): string {
  if (!name) return "Client";
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim();
  if (!cleaned) return "Client";
  return cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/** Trigger a download in the browser using a blob URL (session-safe). */
export async function downloadQuotePdf(args: QuotePdfArgs) {
  const doc = await buildQuotePdf(args);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  a.download = `MaisonAffluency_Quote_${slugifyClient(args.clientName)}_${yyyy}-${mm}-${dd}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/**
 * Build the PDF and return a blob URL suitable for previewing in an iframe
 * (or `window.open`). Caller is responsible for revoking the URL when done.
 */
export async function previewQuotePdfUrl(args: QuotePdfArgs): Promise<string> {
  const doc = await buildQuotePdf(args);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

