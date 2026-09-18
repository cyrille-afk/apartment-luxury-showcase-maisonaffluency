import { calculateSplits, type Absorption, type SplitLineInput } from "./commissionSplit.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Builds the commission ledger rows for a paid shop order.
 * Idempotent: the unique index on line_item_id makes Stripe retries no-ops.
 */
export async function recordDesignerPayouts(
  supabase: SupabaseLike,
  args: {
    orderId: string;
    tradeProgramId?: string | null;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    chargeStripeFees?: boolean;
  },
): Promise<{ inserted: number } | { error: string }> {
  const { data: order, error: orderErr } = await supabase
    .from("shop_orders")
    .select("id, currency, discount_cents")
    .eq("id", args.orderId)
    .maybeSingle();
  if (orderErr) return { error: orderErr.message };
  if (!order) return { error: "order not found" };

  const { data: items, error: itemsErr } = await supabase
    .from("shop_order_items")
    .select("id, designer_slug, designer_name, line_total_cents, unit_price_cents, quantity")
    .eq("order_id", args.orderId);
  if (itemsErr) return { error: itemsErr.message };
  if (!items || items.length === 0) return { inserted: 0 };

  const slugs = [...new Set(items.map((i: any) => i.designer_slug).filter(Boolean))];
  const designerBySlug = new Map<string, any>();
  if (slugs.length > 0) {
    const { data: designers } = await supabase
      .from("designers")
      .select("id, slug, name, commission_rate_pct, trade_discount_absorption")
      .in("slug", slugs);
    for (const d of designers ?? []) designerBySlug.set(d.slug, d);
  }

  const lines: SplitLineInput[] = items.map((item: any) => {
    const designer = item.designer_slug ? designerBySlug.get(item.designer_slug) : null;
    const gross =
      Number(item.line_total_cents) ||
      Number(item.unit_price_cents ?? 0) * Number(item.quantity ?? 1);
    return {
      lineItemId: item.id,
      designerId: designer?.id ?? null,
      designerName: designer?.name ?? item.designer_name ?? null,
      grossCents: Math.max(0, Math.round(gross)),
      commissionRatePct: designer?.commission_rate_pct ?? null,
      absorption: (designer?.trade_discount_absorption as Absorption) ?? "platform",
    };
  });

  const split = calculateSplits({
    lines,
    tradeDiscountCents: Number(order.discount_cents ?? 0),
    tradeProgramId: args.tradeProgramId ?? (Number(order.discount_cents ?? 0) > 0 ? "order_discount" : null),
    chargeStripeFees: args.chargeStripeFees,
  });

  const rows = split.lines.map((l) => ({
    order_id: args.orderId,
    line_item_id: l.lineItemId,
    designer_id: l.designerId,
    designer_name: l.designerName,
    currency: (order.currency || "usd").toLowerCase(),
    gross_amount: l.grossAmount,
    trade_discount_applied: l.tradeDiscountApplied,
    trade_program_id: args.tradeProgramId ?? null,
    discount_absorbed_by: l.discountAbsorbedBy,
    commission_rate_pct: l.commissionRatePct,
    stripe_fee_cents: l.stripeFeeCents,
    platform_fee: l.platformFee,
    designer_net_payout: l.designerNetPayout,
    payout_status: "pending",
    stripe_session_id: args.stripeSessionId ?? null,
    stripe_payment_intent_id: args.stripePaymentIntentId ?? null,
  }));

  const { error: insErr, data: inserted } = await supabase
    .from("designer_payouts")
    .upsert(rows, { onConflict: "line_item_id", ignoreDuplicates: true })
    .select("id");
  if (insErr) return { error: insErr.message };
  return { inserted: inserted?.length ?? 0 };
}
