import {
  calculateProcurement,
  type ProcurementLineInput,
} from "./wholesaleProcurement.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Generates the wholesale accounts-payable ledger for a paid shop order.
 * Idempotent: the unique index on line_item_id makes Stripe retries no-ops.
 */
export async function recordPurchaseOrdersPayable(
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
      .select("id, slug, name, wholesale_discount_pct, commission_rate_pct")
      .in("slug", slugs);
    for (const d of designers ?? []) designerBySlug.set(d.slug, d);
  }

  const lines: ProcurementLineInput[] = items.map((item: any) => {
    const designer = item.designer_slug ? designerBySlug.get(item.designer_slug) : null;
    const rrp =
      Number(item.line_total_cents) ||
      Number(item.unit_price_cents ?? 0) * Number(item.quantity ?? 1);
    // Legacy contracts stored the designer share; wholesale discount is its complement.
    const legacy =
      designer?.commission_rate_pct != null ? 100 - Number(designer.commission_rate_pct) : null;
    return {
      lineItemId: item.id,
      designerId: designer?.id ?? null,
      designerName: designer?.name ?? item.designer_name ?? null,
      retailRrpCents: Math.max(0, Math.round(rrp)),
      wholesaleDiscountPct: designer?.wholesale_discount_pct ?? legacy,
    };
  });

  const result = calculateProcurement({
    lines,
    retailDiscountCents: Number(order.discount_cents ?? 0),
    tradeProgramId: args.tradeProgramId ?? null,
    chargeStripeFees: args.chargeStripeFees,
  });

  const rows = result.lines.map((l) => ({
    order_id: args.orderId,
    line_item_id: l.lineItemId,
    designer_id: l.designerId,
    designer_name: l.designerName,
    currency: (order.currency || "usd").toLowerCase(),
    retail_rrp: l.retailRrp,
    wholesale_discount_pct: l.wholesaleDiscountPct,
    purchase_cost_cogs: l.purchaseCostCogs,
    sold_price_gross: l.soldPriceGross,
    retail_discount_applied: l.retailDiscountApplied,
    stripe_processing_fees: l.stripeProcessingFees,
    net_maison_margin: l.netMaisonMargin,
    trade_program_id: args.tradeProgramId ?? null,
    designer_invoice_status: "pending",
    stripe_session_id: args.stripeSessionId ?? null,
    stripe_payment_intent_id: args.stripePaymentIntentId ?? null,
  }));

  const { error: insErr, data: inserted } = await supabase
    .from("purchase_orders_payable")
    .upsert(rows, { onConflict: "line_item_id", ignoreDuplicates: true })
    .select("id");
  if (insErr) return { error: insErr.message };
  return { inserted: inserted?.length ?? 0 };
}
