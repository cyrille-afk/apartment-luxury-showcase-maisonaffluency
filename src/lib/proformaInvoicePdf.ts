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

const FG = [26, 26, 26] as const;
const MUTED = [110, 110, 110] as const;
const RULE = [214, 212, 206] as const;

export interface ProformaLine {
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
  totalCents: number;
  channel: TradePaymentChannel;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);

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
    ["Issued", issued.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
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
    ...(args.buyer.address ? doc.splitTextToSize(args.buyer.address, contentW * 0.55) : []),
  ].filter(Boolean) as string[];
  billLines.forEach((line, i) => doc.text(line, M, y + 16 + i * 13));
  y += 22 + billLines.length * 13;

  rule(y);
  y += 18;

  /* Line items ------------------------------------------------------ */
  const colQty = right - 210;
  const colUnit = right - 120;
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

  const ensureRoom = (needed: number) => {
    if (y + needed < pageH - 96) return;
    footer();
    doc.addPage();
    y = M;
  };

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
    doc.text(money(line.unitCents, args.currency), colUnit, y, { align: "right" });
    doc.text(money(line.unitCents * line.quantity, args.currency), right, y, { align: "right" });

    if (detail) {
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(detail, M, y + blockH);
    }
    y += blockH + (detail ? 14 : 4) + 12;
  }

  rule(y);
  y += 16;

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

  totalRow("Subtotal", money(args.subtotalCents, args.currency));
  if (args.discountCents > 0) {
    totalRow(args.discountLabel || "Trade discount", `- ${money(args.discountCents, args.currency)}`);
  }
  totalRow(
    args.shippingLabel || "Freight & white-glove delivery",
    args.shippingCents > 0 ? money(args.shippingCents, args.currency) : "To be quoted",
  );
  totalRow(args.taxLabel, args.taxCents > 0 ? money(args.taxCents, args.currency) : "—");
  y += 4;
  rule(y);
  y += 18;
  totalRow("Total due", money(args.totalCents, args.currency), true);

  /* Payment instructions -------------------------------------------- */
  ensureRoom(190);
  y += 8;
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
    y += Math.max(14, valueLines.length * 12 + 2);
  }

  y += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  for (const note of args.channel.instructions) {
    const noteLines = doc.splitTextToSize(`— ${note}`, contentW) as string[];
    ensureRoom(noteLines.length * 11 + 4);
    noteLines.forEach((n, i) => doc.text(n, M, y + i * 11));
    y += noteLines.length * 11 + 3;
  }

  /* Mandatory reference call-out ------------------------------------ */
  ensureRoom(56);
  y += 10;
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
