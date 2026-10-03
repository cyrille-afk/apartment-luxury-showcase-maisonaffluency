// Server-derived payable total for a saved trade quote. Mirrors the payer
// total used by create-quote-payment (items, net-buy discount, SGD GST,
// locked managed freight). Used to bound admin-generated payment links.
// deno-lint-ignore-file no-explicit-any

export type QuoteTotal =
  | { ok: true; totalCents: number; currency: string }
  | { ok: false; error: string };

export async function resolveQuoteTotal(admin: any, quoteId: string): Promise<QuoteTotal> {
  const { data: quote } = await admin
    .from("trade_quotes")
    .select("id, currency, billing_mode, net_discount_pct, managed_freight_quote_id, credit_applied_cents")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found" };

  const { data: items } = await admin
    .from("trade_quote_items")
    .select("quantity, unit_price_cents, fabric_upcharge_cents, crating_cents, trade_products(trade_price_cents)")
    .eq("quote_id", quoteId);
  if (!items || items.length === 0) return { ok: false, error: "This quote has no priced items" };

  let subtotal = 0;
  for (const it of items) {
    const unit = Number(it.unit_price_cents ?? it.trade_products?.trade_price_cents ?? 0) +
      Number(it.fabric_upcharge_cents ?? 0);
    subtotal += unit * Number(it.quantity ?? 1) + Number(it.crating_cents ?? 0);
  }
  if (quote.billing_mode === "net_buy") {
    subtotal = Math.round(subtotal * (1 - Number(quote.net_discount_pct ?? 0) / 100));
  }
  const currency = String(quote.currency || "SGD").toUpperCase();
  let total = subtotal;
  if (currency === "SGD" && subtotal > 0) total += Math.round(subtotal * 0.09);

  if (quote.managed_freight_quote_id) {
    const { data: freight } = await admin
      .from("shipping_quotes")
      .select("total_cents, currency, status")
      .eq("id", quote.managed_freight_quote_id)
      .maybeSingle();
    if (freight && !["cancelled", "expired"].includes(freight.status) &&
      String(freight.currency || "").toUpperCase() === currency) {
      total += Math.max(0, Math.round(Number(freight.total_cents) || 0));
    }
  }
  total -= Math.max(0, Number(quote.credit_applied_cents ?? 0));
  if (total <= 0) return { ok: false, error: "This quote has no payable total yet" };
  return { ok: true, totalCents: total, currency };
}
