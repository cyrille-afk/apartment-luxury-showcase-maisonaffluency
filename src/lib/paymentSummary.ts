import { quoteChargeBreakdown, type QuoteCharge } from "./quoteChargeBreakdown";
import { reconcileQuotePayment } from "./quotePaymentReconciliation";
import { formatPdfDate } from "./pdfFormatting";

export type PaymentSummaryInput = {
  quoteNumber: string; clientName: string; projectName?: string | null;
  currency: string; locale: string; taxLabel: string; taxRate: number;
  subtotalCents?: number; discountCents?: number; discountPct?: number;
  goodsCents: number; shippingCents: number; charges: QuoteCharge[];
  taxCents: number; totalCents: number; depositCents: number; balanceCents: number;
  depositPct: number; paymentType: "deposit" | "balance";
  processingFeeCents: number; cardTotalCents: number;
  paymentDueAt?: string | null;
};

export function paymentSummaryDueDate(input: Pick<PaymentSummaryInput, "paymentDueAt" | "paymentType" | "locale">): string {
  if (input.paymentDueAt) {
    const date = new Date(input.paymentDueAt);
    if (Number.isFinite(date.getTime())) return formatPdfDate(date, input.locale);
  }
  return input.paymentType === "deposit" ? "On order confirmation" : "Before shipment — date to be confirmed";
}

export function paymentSummaryRows(input: PaymentSummaryInput) {
  const amounts = { chargesCents: input.charges.reduce((sum, charge) => sum + charge.amountCents, 0),
    gstCents: input.taxCents, totalCents: input.totalCents, depositCents: input.depositCents, balanceCents: input.balanceCents };
  const check = reconcileQuotePayment({ quoted: amounts, displayed: amounts, goodsCents: input.goodsCents,
    shippingCents: input.shippingCents, taxRate: input.taxRate, depositPct: input.depositPct, charges: input.charges });
  if (!check.ok) throw new Error("Payment summary amounts do not reconcile.");
  const due = input.paymentType === "deposit" ? input.depositCents : input.balanceCents;
  if (!Number.isSafeInteger(input.processingFeeCents) || input.processingFeeCents < 0 || due + input.processingFeeCents !== input.cardTotalCents) {
    throw new Error("Card payment summary amounts do not reconcile.");
  }
  const gst = input.goodsCents > 0 ? Math.round(input.goodsCents * input.taxRate / 100) : 0;
  const goodsTotal = input.goodsCents + gst;
  const goodsDeposit = Math.round(goodsTotal * input.depositPct);
  const baseDeposit = Math.round((goodsTotal + input.shippingCents) * input.depositPct);
  const shippingDeposit = baseDeposit - goodsDeposit;
  return [
    { id: "goods", label: "Net subtotal", amountCents: input.goodsCents, gstCents: gst,
      totalCents: goodsTotal, depositCents: goodsDeposit, balanceCents: goodsTotal - goodsDeposit },
    ...quoteChargeBreakdown(input.charges, input.goodsCents, input.taxRate, input.shippingCents, input.depositPct),
    ...(input.shippingCents > 0 ? [{ id: "shipping", label: "Shipping estimate", amountCents: input.shippingCents, gstCents: 0,
      totalCents: input.shippingCents, depositCents: shippingDeposit, balanceCents: input.shippingCents - shippingDeposit }] : []),
  ];
}