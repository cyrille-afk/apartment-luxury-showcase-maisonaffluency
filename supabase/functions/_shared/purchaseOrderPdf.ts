import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

// Prefer the library's own StandardFonts enum; fall back to the literal PDF
// base-14 names if the CJS interop does not surface it.
const FONT = {
  serif: StandardFonts?.TimesRoman ?? "Times-Roman",
  serifBold: StandardFonts?.TimesRomanBold ?? "Times-Bold",
  sans: StandardFonts?.Helvetica ?? "Helvetica",
  sansBold: StandardFonts?.HelveticaBold ?? "Helvetica-Bold",
} as const;

export interface PoPdfLine {
  description: string;
  reference?: string | null;
  quantity: number;
  retailRrp: number; // minor units
  wholesaleDiscountPct: number;
  purchaseCostCogs: number; // minor units
}

export interface PoPdfInput {
  poNumber: string;
  issuedAt: Date;
  currency: string;
  designerName: string;
  designerEmail?: string | null;
  contractTier?: string | null;
  orderRef?: string | null;
  lines: PoPdfLine[];
}

const JADE = rgb(0.07, 0.21, 0.17);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.43, 0.43, 0.43);
const RULE = rgb(0.85, 0.84, 0.81);

const money = (cents: number, currency: string) =>
  `${currency.toUpperCase()} ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Renders the wholesale purchase order Maison Affluency issues to a designer.
 * Generous margins, a single hairline-ruled table and a jade accent band —
 * the same structural rhythm as the studio PDF templates.
 */
export async function buildPurchaseOrderPdf(input: PoPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Purchase Order ${input.poNumber}`);
  pdf.setAuthor("Maison Affluency");

  const serif = await pdf.embedFont(FONT.serif);
  const serifBold = await pdf.embedFont(FONT.serifBold);
  const sans = await pdf.embedFont(FONT.sans);
  const sansBold = await pdf.embedFont(FONT.sansBold);

  const W = 595.28;
  const H = 841.89;
  const M = 56;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const ensure = (needed: number) => {
    if (y - needed < M + 60) newPage();
  };
  const label = (text: string, x: number, yy: number) =>
    page.drawText(text.toUpperCase(), { x, y: yy, size: 7.5, font: sansBold, color: MUTED });
  const rule = (yy: number) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.5, color: RULE });

  // Masthead
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: JADE });
  page.drawText("MAISON AFFLUENCY", { x: M, y: y - 6, size: 16, font: serif, color: JADE });
  page.drawText("Affluency Etc Pte Ltd · Trade Procurement", {
    x: M,
    y: y - 22,
    size: 8.5,
    font: sans,
    color: MUTED,
  });
  page.drawText("PURCHASE ORDER", {
    x: W - M - sansBold.widthOfTextAtSize("PURCHASE ORDER", 10),
    y: y - 6,
    size: 10,
    font: sansBold,
    color: INK,
  });
  page.drawText(input.poNumber, {
    x: W - M - serifBold.widthOfTextAtSize(input.poNumber, 13),
    y: y - 24,
    size: 13,
    font: serifBold,
    color: JADE,
  });
  y -= 44;
  rule(y);
  y -= 26;

  // Parties
  const issued = input.issuedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const colR = W / 2 + 10;
  label("Supplier", M, y);
  label("Issued", colR, y);
  y -= 14;
  page.drawText(input.designerName, { x: M, y, size: 12, font: serif, color: INK });
  page.drawText(issued, { x: colR, y, size: 11, font: serif, color: INK });
  y -= 14;
  if (input.designerEmail) {
    page.drawText(input.designerEmail, { x: M, y, size: 9, font: sans, color: MUTED });
  }
  if (input.orderRef) {
    page.drawText(`Order ${input.orderRef}`, { x: colR, y, size: 9, font: sans, color: MUTED });
  }
  y -= 13;
  if (input.contractTier) {
    page.drawText(`Contract tier: ${input.contractTier}`, { x: M, y, size: 9, font: sans, color: MUTED });
  }
  page.drawText("Billed to: Maison Affluency (merchant of record)", {
    x: colR,
    y,
    size: 9,
    font: sans,
    color: MUTED,
  });
  y -= 26;
  rule(y);
  y -= 22;

  // Table header
  const cols = { item: M, qty: 300, rrp: 340, disc: 420, cogs: W - M };
  label("Item", cols.item, y);
  label("Qty", cols.qty, y);
  page.drawText("RRP", {
    x: cols.disc - 12 - sansBold.widthOfTextAtSize("RRP", 7.5),
    y,
    size: 7.5,
    font: sansBold,
    color: MUTED,
  });
  page.drawText("DISC.", {
    x: cols.disc + 18,
    y,
    size: 7.5,
    font: sansBold,
    color: MUTED,
  });
  page.drawText("WHOLESALE COST", {
    x: cols.cogs - sansBold.widthOfTextAtSize("WHOLESALE COST", 7.5),
    y,
    size: 7.5,
    font: sansBold,
    color: MUTED,
  });
  y -= 8;
  rule(y);
  y -= 18;

  let totalRrp = 0;
  let totalCogs = 0;

  for (const line of input.lines) {
    ensure(48);
    totalRrp += line.retailRrp;
    totalCogs += line.purchaseCostCogs;

    const desc = line.description.length > 48 ? `${line.description.slice(0, 47)}…` : line.description;
    page.drawText(desc, { x: cols.item, y, size: 10.5, font: serif, color: INK });
    page.drawText(String(line.quantity), { x: cols.qty, y, size: 10, font: sans, color: INK });

    const rrpText = money(line.retailRrp, input.currency);
    page.drawText(rrpText, {
      x: cols.disc - 12 - sans.widthOfTextAtSize(rrpText, 9.5),
      y,
      size: 9.5,
      font: sans,
      color: MUTED,
    });
    page.drawText(`${line.wholesaleDiscountPct}%`, {
      x: cols.disc + 18,
      y,
      size: 9.5,
      font: sans,
      color: MUTED,
    });
    const cogsText = money(line.purchaseCostCogs, input.currency);
    page.drawText(cogsText, {
      x: cols.cogs - sansBold.widthOfTextAtSize(cogsText, 10),
      y,
      size: 10,
      font: sansBold,
      color: INK,
    });

    if (line.reference) {
      y -= 12;
      page.drawText(line.reference, { x: cols.item, y, size: 8, font: sans, color: MUTED });
    }
    y -= 18;
  }

  ensure(120);
  rule(y + 4);
  y -= 18;

  const totalLabel = "Total payable by Maison Affluency";
  page.drawText(totalLabel, { x: cols.item, y, size: 10.5, font: serif, color: INK });
  const totalText = money(totalCogs, input.currency);
  page.drawText(totalText, {
    x: cols.cogs - serifBold.widthOfTextAtSize(totalText, 13),
    y: y - 2,
    size: 13,
    font: serifBold,
    color: JADE,
  });
  y -= 18;
  const rrpTotalText = `Retail reference ${money(totalRrp, input.currency)}`;
  page.drawText(rrpTotalText, {
    x: cols.cogs - sans.widthOfTextAtSize(rrpTotalText, 8.5),
    y,
    size: 8.5,
    font: sans,
    color: MUTED,
  });

  y -= 40;
  ensure(90);
  page.drawRectangle({ x: M, y: y - 62, width: W - M * 2, height: 66, color: rgb(0.97, 0.965, 0.95) });
  page.drawText("Terms", { x: M + 16, y: y - 12, size: 9, font: sansBold, color: JADE });
  const terms = [
    "Maison Affluency is the direct billing client for this transaction; the end buyer is not a party to it.",
    "Wholesale cost is fixed at confirmation and is not affected by retail markdowns or trade discounts.",
    "Please issue your invoice quoting this purchase order reference for settlement matching.",
  ];
  let ty = y - 26;
  for (const t of terms) {
    page.drawText(`· ${t}`, { x: M + 16, y: ty, size: 8.5, font: sans, color: INK });
    ty -= 13;
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${input.poNumber} · Maison Affluency · Page ${i + 1} of ${pages.length}`, {
      x: M,
      y: 34,
      size: 7.5,
      font: sans,
      color: MUTED,
    });
  });

  return await pdf.save();
}
