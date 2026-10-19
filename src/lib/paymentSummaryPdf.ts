import { jsPDF } from "jspdf";
import { formatPdfDate, formatPdfMoney } from "./pdfFormatting";
import { paymentSummaryRows, paymentSummaryDueDate, type PaymentSummaryInput } from "./paymentSummary";

const PALETTE = { jade: [12, 49, 47], ink: [40, 40, 40], muted: [115, 115, 115], rule: [200, 198, 192] } as const;

async function fontData(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Payment PDF font unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function buildPaymentSummaryPdf(input: PaymentSummaryInput): Promise<Blob> {
  const rows = paymentSummaryRows(input);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const fonts = await Promise.all([fontData("/fonts/pdf/Inter-Light.ttf"), fontData("/fonts/pdf/CormorantGaramond-Regular.ttf")]);
  doc.addFileToVFS("Inter.ttf", fonts[0]); doc.addFont("Inter.ttf", "Inter", "normal");
  doc.addFileToVFS("Cormorant.ttf", fonts[1]); doc.addFont("Cormorant.ttf", "Cormorant", "normal");
  doc.setProperties({ title: `${input.quoteNumber} Payment Summary`, author: "Maison Affluency" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 44;
  const money = (cents: number) => `${formatPdfMoney(cents, input.currency, input.locale)} ${input.currency}`;
  let y = 0;
  const header = () => {
    doc.setFont("Cormorant").setFontSize(27).setTextColor(...PALETTE.jade).text("Maison Affluency", M, 49);
    doc.setFont("Inter").setFontSize(8).setTextColor(...PALETTE.muted);
    doc.text(formatPdfDate(new Date(), input.locale), W - M, 49, { align: "right" });
    doc.text(input.quoteNumber, W - M, 67, { align: "right" });
    doc.setDrawColor(...PALETTE.rule).line(M, 83, W - M, 83);
    doc.setFont("Cormorant").setFontSize(24).setTextColor(...PALETTE.jade).text("Payment summary", M, 116);
    doc.setFont("Inter").setFontSize(9).setTextColor(...PALETTE.muted);
    y = 137;
    for (const text of [`Quote number: ${input.quoteNumber}`, `Customer: ${input.clientName || "Not specified"}`, input.projectName,
      `Payment due date (${input.paymentType}): ${paymentSummaryDueDate(input)}`].filter(Boolean)) {
      const lines = doc.splitTextToSize(String(text), W - M * 2);
      doc.text(lines, M, y); y += lines.length * 12 + 3;
    }
    y += 14;
  };
  const space = (height: number) => { if (y + height > H - 65) { doc.addPage(); header(); } };
  const row = (label: string, amount: number, strong = false) => {
    const color = strong ? PALETTE.jade : PALETTE.ink;
    doc.setFont("Inter").setFontSize(strong ? 11 : 9).setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(label, 290); const height = lines.length * 13 + 10;
    space(height); doc.text(lines, M, y); doc.text(money(amount), W - M, y, { align: "right" }); y += height;
  };
  header();
  if (input.subtotalCents != null) {
    row("Item subtotal", input.subtotalCents);
    if ((input.discountCents ?? 0) > 0) row(`Trade discount (${Math.round((input.discountPct ?? 0) * 100)}%)`, -(input.discountCents ?? 0));
    y += 8;
  }
  for (const charge of rows) {
    doc.setFont("Inter").setFontSize(10);
    const lines = doc.splitTextToSize(charge.label, W - M * 2);
    space(lines.length * 13 + 145);
    doc.setTextColor(...PALETTE.jade).text(lines, M, y); y += lines.length * 13 + 8;
    row("Charge", charge.amountCents);
    row(`${input.taxLabel} (${charge.id === "shipping" ? 0 : input.taxRate}%)`, charge.gstCents);
    row("Including tax", charge.totalCents);
    // Keep columns separate and use the same cumulative allocations as the screen.
    doc.setFontSize(8).setTextColor(...PALETTE.muted);
    doc.text(`${Math.round(input.depositPct * 100)}% deposit share`, M, y);
    doc.text(`${Math.round((1 - input.depositPct) * 100)}% balance share`, M + 260, y);
    y += 14; doc.setTextColor(...PALETTE.ink).setFontSize(9);
    doc.text(money(charge.depositCents), M, y); doc.text(money(charge.balanceCents), M + 260, y);
    y += 19; doc.setDrawColor(...PALETTE.rule).line(M, y, W - M, y); y += 23;
  }
  space(190);
  row(`Total ${input.taxLabel}`, input.taxCents);
  row("Order total", input.totalCents, true);
  row(`${Math.round(input.depositPct * 100)}% deposit`, input.depositCents, true);
  row(`${Math.round((1 - input.depositPct) * 100)}% balance`, input.balanceCents, true);
  y += 8;
  row(input.paymentType === "deposit" ? "Deposit due now" : "Balance due now", input.paymentType === "deposit" ? input.depositCents : input.balanceCents);
  row("Stripe processing fee (3.4% + fixed)", input.processingFeeCents);
  row("Total charge to your card", input.cardTotalCents, true);
  space(35); doc.setFontSize(8).setTextColor(...PALETTE.muted);
  doc.text("Payment summary — not a payment receipt. Shipping estimates may change before shipment.", M, y + 8);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(...PALETTE.rule).line(M, H - 45, W - M, H - 45);
    doc.setFont("Inter").setFontSize(7).setTextColor(...PALETTE.muted);
    doc.text("Maison Affluency · maisonaffluency.com", M, H - 29);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, W - M, H - 29, { align: "right" });
  }
  return doc.output("blob");
}