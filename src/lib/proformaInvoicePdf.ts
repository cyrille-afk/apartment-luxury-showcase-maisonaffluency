/**
 * Pro-forma Invoice PDF
 * ---------------------
 * A4 portrait, house typography (Times display + Helvetica body), matching the
 * Fabric & Finishes sheet: centred logo footer, hairline rules, tabular figures.
 *
 * Used for bank-settled trade orders (PayNow / FAST / SWIFT). The document is
 * generated client-side, uploaded to the private `proforma-invoices` bucket and
 * emailed to the buyer by the `send-proforma-invoice` function.
 */
import jsPDF from "jspdf";
import affluencyLogoUrl from "@/assets/affluency-quote-logo.jpg";
import {
  CORPORATE_IDENTITY,
  type PaymentDetailRow,
  type TradePaymentChannel,
} from "@/config/tradePaymentChannels";
import { calculateCeilingBudget, type CeilingBudgetInput } from "@/lib/ceilingBudget";
import { formatPdfDate, formatPdfMoney, type PdfLocalePreset } from "@/lib/pdfFormatting";

const FG = [26, 26, 26] as const;
const MUTED = [110, 110, 110] as const;
const RULE = [214, 212, 206] as const;

export interface ProformaLine {
  /** Catalogue pick id — required for server-side price verification. */
  pickId?: string | null;
  title: string;
  designer?: string | null;
  finishLabel?: string | null;
  quantity: number;
  unitCents: number;
}

export interface ProformaArgs {
  orderRef: string;
  issuedAt?: Date;
  currency: string;
  buyer: { name: string; email: string; phone?: string | null; address?: string | null };
  regionTier: string;
  lines: ProformaLine[];
  subtotalCents: number;
  discountCents: number;
  discountLabel?: string | null;
  shippingCents: number;
  shippingLabel?: string | null;
  taxCents: number;
  taxLabel: string;
  /** Invoice-grade tax statement, e.g. VAT reverse-charge wording. */
  taxStatement?: string | null;
  /** Buyer's own VAT / GST registration number, printed under Bill To. */
  buyerTaxId?: string | null;
  totalCents: number;
  channel: TradePaymentChannel;
  /** Replaces the itemized ledger and standard totals with a ceiling matrix. */
  ceilingBudget?: CeilingBudgetInput | null;
  formatting?: { locale: PdfLocalePreset };
}

const money = (cents: number, currency: string, locale?: string) => formatPdfMoney(cents, currency, locale);

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildProformaInvoicePdf(args: ProformaArgs): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 54;
  const contentW = pageW - 2 * M;
  const right = pageW - M;
  const issued = args.issuedAt ?? new Date();
  const logo = await fetchDataUrl(affluencyLogoUrl);

  const footer = () => {
    if (logo) {
      try {
        doc.addImage(logo, "JPEG", (pageW - 42) / 2, pageH - 66, 42, 42, undefined, "FAST");
      } catch {
        /* decorative */
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `${CORPORATE_IDENTITY.beneficiary} · UEN ${CORPORATE_IDENTITY.uen} · maisonaffluency.com`,
      pageW / 2,
      pageH - 16,
      { align: "center" },
    );
  };

  const rule = (y: number) => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.5);
    doc.line(M, y, right, y);
  };

  let y = M + 6;

  /* Masthead ------------------------------------------------------- */
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.setFont("times", "normal");
  doc.setFontSize(26);
  doc.text("Pro-forma Invoice", M, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("MAISON AFFLUENCY", right, y - 2, { align: "right", charSpace: 1.6 });
  doc.text(CORPORATE_IDENTITY.beneficiary, right, y + 11, { align: "right" });
  doc.text(`UEN ${CORPORATE_IDENTITY.uen}`, right, y + 23, { align: "right" });

  y += 34;
  rule(y);
  y += 20;

  /* Meta block ------------------------------------------------------ */
  const meta: [string, string][] = [
    ["Order ID", args.orderRef],
    ["Issued", formatPdfDate(issued, args.formatting?.locale)],
    ["Region", args.regionTier],
    ["Settlement", args.channel.label],
  ];
  doc.setFontSize(8);
  meta.forEach(([label, value], i) => {
    const x = M + (contentW / meta.length) * i;
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label.toUpperCase(), x, y, { charSpace: 1.2 });
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.setFontSize(9.5);
    doc.text(value, x, y + 14);
    doc.setFontSize(8);
  });
  y += 34;

  /* Bill to --------------------------------------------------------- */
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(8);
  doc.text("BILL TO", M, y, { charSpace: 1.2 });
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.setFontSize(10);
  const billLines = [
    args.buyer.name,
    args.buyer.email,
    args.buyer.phone || "",
    args.buyerTaxId ? `VAT / GST Reg. No. ${args.buyerTaxId}` : "",
    ...(args.buyer.address ? doc.splitTextToSize(args.buyer.address, contentW * 0.55) : []),
  ].filter(Boolean) as string[];
  billLines.forEach((line, i) => doc.text(line, M, y + 16 + i * 13));
  y += 22 + billLines.length * 13;

  rule(y);
  y += 18;

  /* Line items / target ceiling ledger ----------------------------- */
  const colQty = right - 210;
  const colUnit = right - 120;

  const ensureRoom = (needed: number) => {
    if (y + needed < pageH - 74) return;
    footer();
    doc.addPage();
    y = M;
  };

  if (args.ceilingBudget) {
    const budget = calculateCeilingBudget(args.ceilingBudget);
    ensureRoom(196);
    doc.setFillColor(250, 249, 246);
    doc.rect(M, y, contentW, 190, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text("TARGET CEILING BUDGET SUMMARY", M + 14, y + 20, { charSpace: 1.1 });
    rule(y + 30);
    const tier = budget.tierLabel ? `${budget.tierLabel} ` : "";
    const rows = [
      ["Target Client Ceiling Budget", budget.targetCeilingCents],
      [`Designer Net Profit Margin (${budget.clientMarkupPct.toFixed(2)}%)`, budget.designerNetProfitCents],
      ["Max Allowed Designer Cost", budget.maxDesignerCostCents],
      [`Trade Sourcing Markdown (${tier}${budget.tradeDiscountPct.toFixed(2)}%)`, -budget.tradeSourcingMarkdownCents],
      ["Net Purchasing Sourcing Budget", budget.netPurchasingBudgetCents],
    ] as const;
    let budgetY = y + 52;
    rows.forEach(([label, amount], index) => {
      if (index === rows.length - 1) rule(budgetY - 12);
      doc.setFont("helvetica", index === 0 || index === rows.length - 1 ? "bold" : "normal");
      doc.setFontSize(index === 0 || index === rows.length - 1 ? 10.5 : 9.5);
      doc.setTextColor(index === 0 || index === rows.length - 1 ? FG[0] : MUTED[0], index === 0 || index === rows.length - 1 ? FG[1] : MUTED[1], index === 0 || index === rows.length - 1 ? FG[2] : MUTED[2]);
      doc.text(label, M + 14, budgetY);
      doc.setTextColor(FG[0], FG[1], FG[2]);
      doc.text(amount < 0 ? `- ${money(Math.abs(amount), args.currency, args.formatting?.locale)}` : money(amount, args.currency, args.formatting?.locale), right - 14, budgetY, { align: "right" });
      budgetY += 28;
    });
    y += 206;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("DESCRIPTION", M, y, { charSpace: 1.2 });
    doc.text("QTY", colQty, y, { align: "right", charSpace: 1.2 });
    doc.text("UNIT", colUnit, y, { align: "right", charSpace: 1.2 });
    doc.text("AMOUNT", right, y, { align: "right", charSpace: 1.2 });
    y += 8;
    rule(y);
    y += 16;

    for (const line of args.lines) {
      const detail = [line.designer, line.finishLabel].filter(Boolean).join(" · ");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(line.title, colQty - M - 20) as string[];
      ensureRoom(titleLines.length * 13 + (detail ? 12 : 0) + 14);

      doc.setTextColor(FG[0], FG[1], FG[2]);
      doc.setFontSize(10);
      titleLines.forEach((t, i) => doc.text(t, M, y + i * 13));
      const blockH = titleLines.length * 13;

      doc.text(String(line.quantity), colQty, y, { align: "right" });
      doc.text(money(line.unitCents, args.currency, args.formatting?.locale), colUnit, y, { align: "right" });
      doc.text(money(line.unitCents * line.quantity, args.currency, args.formatting?.locale), right, y, { align: "right" });

      if (detail) {
        doc.setFontSize(8.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(detail, M, y + blockH);
      }
      y += blockH + (detail ? 13 : 3) + 6;
    }

    rule(y);
    y += 16;
  }

  /* Totals ---------------------------------------------------------- */
  const totalRow = (label: string, value: string, strong = false) => {
    ensureRoom(20);
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(strong ? 11 : 9.5);
    doc.setTextColor(strong ? FG[0] : MUTED[0], strong ? FG[1] : MUTED[1], strong ? FG[2] : MUTED[2]);
    doc.text(label, colUnit, y, { align: "right" });
    doc.setTextColor(FG[0], FG[1], FG[2]);
    doc.text(value, right, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += strong ? 20 : 16;
  };

  if (!args.ceilingBudget) {
    totalRow("Subtotal", money(args.subtotalCents, args.currency, args.formatting?.locale));
    if (args.discountCents > 0) {
      totalRow(args.discountLabel || "Trade discount", `- ${money(args.discountCents, args.currency, args.formatting?.locale)}`);
    }
    totalRow(
      args.shippingLabel || "Freight & white-glove delivery",
      args.shippingCents > 0 ? money(args.shippingCents, args.currency, args.formatting?.locale) : "To be quoted",
    );
    totalRow(args.taxLabel, args.taxCents > 0 ? money(args.taxCents, args.currency, args.formatting?.locale) : "—");
  }
  if (args.taxStatement) {
    ensureRoom(26);
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const noteLines = doc.splitTextToSize(args.taxStatement, contentW) as string[];
    noteLines.forEach((t, i) => doc.text(t, M, y + i * 10));
    y += noteLines.length * 10 + 6;
    doc.setTextColor(FG[0], FG[1], FG[2]);
  }
  if (!args.ceilingBudget) {
    y += 4;
    rule(y);
    y += 18;
    totalRow("Total due", money(args.totalCents, args.currency, args.formatting?.locale), true);
  }

  const paymentBaseCents = args.ceilingBudget
    ? calculateCeilingBudget(args.ceilingBudget).targetCeilingCents
    : args.totalCents;
  ensureRoom(52);
  y += 4;
  rule(y);
  y += 18;
  totalRow("60% deposit", money(Math.round(paymentBaseCents * 0.6), args.currency, args.formatting?.locale));
  totalRow("40% balance", money(paymentBaseCents - Math.round(paymentBaseCents * 0.6), args.currency, args.formatting?.locale));

  /* Payment instructions -------------------------------------------- */
  ensureRoom(300);
  y += 4;
  rule(y);
  y += 20;
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`PAYMENT — ${args.channel.label.toUpperCase()}`, M, y, { charSpace: 1.2 });
  y += 16;

  const rows: PaymentDetailRow[] = args.channel.rows;
  doc.setFontSize(9.5);
  for (const row of rows) {
    ensureRoom(16);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(row.label, M, y);
    doc.setTextColor(FG[0], FG[1], FG[2]);
    const valueLines = doc.splitTextToSize(row.value, contentW - 170) as string[];
    valueLines.forEach((v, i) => doc.text(v, M + 170, y + i * 12));
    y += Math.max(13, valueLines.length * 11.5 + 1);
  }

  y += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  for (const note of args.channel.instructions) {
    const noteLines = doc.splitTextToSize(`— ${note}`, contentW) as string[];
    ensureRoom(noteLines.length * 11 + 4);
    noteLines.forEach((n, i) => doc.text(n, M, y + i * 10.5));
    y += noteLines.length * 10.5 + 2;
  }

  /* Mandatory reference call-out ------------------------------------ */
  ensureRoom(64);
  y += 8;
  doc.setDrawColor(FG[0], FG[1], FG[2]);
  doc.setLineWidth(0.8);
  doc.rect(M, y, contentW, 40);
  doc.setTextColor(FG[0], FG[1], FG[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Reference Note: ${args.orderRef}`, M + 14, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    "This reference must appear on your transfer. Payments received without it may be delayed in reconciliation.",
    M + 14,
    y + 31,
  );
  y += 54;

  /* The closing disclaimer is fine sitting close to the footer rule. */
  if (y > pageH - 66) {
    footer();
    doc.addPage();
    y = M;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    "This pro-forma invoice is not a tax invoice. Goods are reserved on receipt of cleared funds; a final commercial invoice is issued on dispatch.",
    M,
    y,
    { maxWidth: contentW },
  );

  footer();
  return doc;
}
