import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";
import { buildOrderDeliveryMessage } from "../_shared/orderDeliveryMessaging.ts";
import { isBuyerTaxIdValid, resolveTaxRule, resolveTaxTreatment } from "../_shared/taxRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const int = (value: unknown) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const str = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const TERMS = new Set(["net_30", "net_60", "one_percent_10_net_30", "cia_stage"]);
const TERM_LABELS: Record<string, string> = {
  net_30: "Net 30 days",
  net_60: "Net 60 days — verified enterprise only",
  one_percent_10_net_30: "1% 10 / Net 30",
  cia_stage: "Cash in advance / stage payments",
};
const GBP_HIGH_VALUE_CENTS = 2_000_000;
type PurchaseOrderLine = {
  title: string;
  designer_name: string | null;
  finish_label: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: claimData, error: claimError } = await anon.auth.getClaims(authHeader.slice(7));
    const userId = String((claimData?.claims as Record<string, unknown> | undefined)?.sub ?? "");
    if (claimError || !userId) return json({ error: "Invalid or expired session." }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: profile }, { data: tradeApplication }] = await Promise.all([
      admin.from("profiles").select("company, trade_status").eq("id", userId).maybeSingle(),
      admin.from("trade_applications").select("status, tax_vat_id").eq("user_id", userId)
        .eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (profile?.trade_status !== "approved" || tradeApplication?.status !== "approved") {
      return json({ error: "Purchase orders are available to approved trade accounts only." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const currency = str(body?.currency, 8).toLowerCase();
    const shippingCountry = str(body?.shippingCountry, 2).toUpperCase();
    if (currency !== "gbp" || shippingCountry !== "GB") {
      return json({ error: "This purchase-order route is restricted to high-value GBP orders delivered in the UK." }, 400);
    }
    if (body?.buyerType !== "business") return json({ error: "A corporate buyer identity is required." }, 400);

    const companyName = str(body?.companyName, 180);
    const companyRegistrationNumber = str(body?.companyRegistrationNumber, 32).toUpperCase();
    const buyerTaxId = str(body?.buyerTaxId || tradeApplication?.tax_vat_id, 40).toUpperCase();
    const poNumber = str(body?.poNumber, 80);
    const paymentTerms = str(body?.paymentTerms, 40);
    if (!companyName || !companyRegistrationNumber || !poNumber) {
      return json({ error: "Legal company name, company registration number and PO reference are required." }, 400);
    }
    if (!/^[A-Z0-9][A-Z0-9 .\-/]{1,31}$/.test(companyRegistrationNumber)) {
      return json({ error: "Enter a valid corporate registration number." }, 400);
    }
    const ukTaxRule = resolveTaxRule("GB", "gbp");
    if (!isBuyerTaxIdValid(ukTaxRule, buyerTaxId)) return json({ error: "A valid UK VAT number is required." }, 400);
    if (body?.budgetApproved !== true) return json({ error: "Internal budget approval must be confirmed." }, 400);
    if (!TERMS.has(paymentTerms)) return json({ error: "Select valid requested payment terms." }, 400);
    const requestKey = str(body?.requestKey, 36).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestKey)) {
      return json({ error: "A valid purchase-order submission key is required." }, 400);
    }

    const buyer = body?.buyer ?? {};
    const email = str(buyer?.email, 200);
    if (!email.includes("@")) return json({ error: "A valid corporate email is required." }, 400);
    const rawLines = Array.isArray(body?.lines) ? body.lines.slice(0, 60) : [];
    if (!rawLines.length) return json({ error: "At least one line item is required." }, 400);
    const lines: PurchaseOrderLine[] = rawLines.map((line: Record<string, unknown>) => {
      const quantity = Math.min(Math.max(int(line.quantity) || 1, 1), 999);
      const unitPrice = int(line.unitCents);
      return {
        title: str(line.title, 200) || "Bespoke piece",
        designer_name: str(line.designer, 160) || null,
        finish_label: str(line.finishLabel, 250) || null,
        quantity,
        unit_price_cents: unitPrice,
        line_total_cents: unitPrice * quantity,
      };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.line_total_cents, 0);
    const discountCents = Math.min(int(body?.discountCents), subtotalCents);
    const shippingCents = int(body?.shippingCents);
    const treatment = resolveTaxTreatment({
      country: shippingCountry,
      currency,
      buyerType: "business",
      buyerTaxId,
      goodsCents: subtotalCents - discountCents,
      shippingCents,
    });
    const totalCents = subtotalCents - discountCents + shippingCents + treatment.taxCents;
    if (totalCents <= GBP_HIGH_VALUE_CENTS) {
      return json({ error: "Purchase orders are available for GBP orders above £20,000." }, 400);
    }

    const delivery = buildOrderDeliveryMessage({
      shippingCountry,
      deliveryTerm: str(body?.incoterm, 3),
      taxStatement: treatment.statement,
      importDutyCents: int(body?.importDutyCents),
      importTaxCents: int(body?.importVatCents),
      importClearanceCents: int(body?.importClearanceCents),
      ddpHandlingCents: int(body?.ddpHandlingCents),
      importTotalCents: int(body?.importTotalCents),
      deferredImportCents: int(body?.deferredImportCents),
    });
    const orderRef = `PO-${requestKey.toUpperCase()}`;
    const { data: existing } = await admin.from("shop_orders")
      .select("id, order_ref, status")
      .eq("order_ref", orderRef)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return json({ orderId: existing.id, orderRef: existing.order_ref, status: existing.status, duplicate: true });
    const { data: order, error: orderError } = await admin.from("shop_orders").insert({
      order_ref: orderRef,
      user_id: userId,
      email,
      full_name: str(buyer?.name, 160) || null,
      phone: str(buyer?.phone, 60) || null,
      shipping_address: str(buyer?.address, 600) || null,
      payment_method: "purchase_order",
      payment_channel: "corporate_po",
      status: "pending_po_review",
      currency,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      discount_label: str(body?.discountLabel, 120) || null,
      shipping_cents: shippingCents,
      tax_cents: treatment.taxCents,
      tax_label: treatment.label,
      tax_treatment: treatment.treatment,
      tax_rate: treatment.rate,
      tax_statement: treatment.statement,
      buyer_type: "business",
      buyer_tax_id: treatment.buyerTaxId,
      buyer_tax_country: "GB",
      total_cents: totalCents,
      shipping_country: "GB",
      delivery_term: delivery.deliveryTerm,
      import_duty_cents: delivery.importDutyCents,
      import_tax_cents: delivery.importTaxCents,
      import_clearance_cents: delivery.importClearanceCents,
      ddp_handling_cents: delivery.ddpHandlingCents,
      import_total_cents: delivery.importTotalCents,
      deferred_import_cents: delivery.deferredImportCents,
      customs_statement: delivery.customsStatement,
      customer_po_number: poNumber,
      company_name: companyName,
      company_registration_number: companyRegistrationNumber,
      po_payment_terms: paymentTerms,
      budget_approved_at: new Date().toISOString(),
      po_review_status: "pending",
      notes: `Requested terms: ${TERM_LABELS[paymentTerms]}. Subject to credit and order review. Submission ${requestKey}.`,
    }).select("id").single();
    if (orderError || !order) {
      console.error("[create-purchase-order] order insert failed", orderError);
      return json({ error: "Unable to record the purchase order." }, 500);
    }
    const { error: itemError } = await admin.from("shop_order_items")
      .insert(lines.map((line) => ({ ...line, order_id: order.id })));
    if (itemError) {
      console.error("[create-purchase-order] item insert failed", itemError);
      await admin.from("shop_orders").delete().eq("id", order.id);
      return json({ error: "Unable to record the purchase-order items." }, 500);
    }

    const amountLabel = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(totalCents / 100);
    await Promise.all([
      sendLovableEmail({
        to: email,
        label: "purchase-order-received",
        idempotencyKey: `po-buyer-${order.id}`,
        subject: `Purchase order received — ${orderRef}`,
        html: `<div style="font-family:Arial,sans-serif;color:#14201c;line-height:1.6"><h2 style="font-weight:400">Purchase order received</h2><p>We have received purchase order <strong>${escapeHtml(poNumber)}</strong> from ${escapeHtml(companyName)} for ${escapeHtml(amountLabel)}.</p><p>Requested terms: ${escapeHtml(TERM_LABELS[paymentTerms])}. These terms, credit status, product availability and production release remain subject to Maison Affluency review. We will confirm the approved settlement schedule before the order becomes binding.</p><p>${escapeHtml(treatment.statement)}</p>${delivery.customsStatement ? `<p>${escapeHtml(delivery.customsStatement)}</p>` : ""}<p>Reference: ${escapeHtml(orderRef)}</p></div>`,
      }, admin),
      sendLovableEmail({
        to: ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"],
        label: "purchase-order-review",
        idempotencyKey: `po-admin-${order.id}`,
        subject: `Purchase order review required — ${companyName} — ${amountLabel}`,
        html: `<div style="font-family:Arial,sans-serif;color:#14201c;line-height:1.6"><h2 style="font-weight:400">Corporate purchase order awaiting review</h2><p><strong>Order:</strong> ${escapeHtml(orderRef)}<br/><strong>Buyer PO:</strong> ${escapeHtml(poNumber)}<br/><strong>Company:</strong> ${escapeHtml(companyName)}<br/><strong>Registration:</strong> ${escapeHtml(companyRegistrationNumber)}<br/><strong>VAT:</strong> ${escapeHtml(buyerTaxId)}<br/><strong>Amount:</strong> ${escapeHtml(amountLabel)}<br/><strong>Requested terms:</strong> ${escapeHtml(TERM_LABELS[paymentTerms])}</p><p>The buyer attested that internal budget approval is secured. Confirm corporate identity, credit standing and final payment terms before releasing production.</p><p><a href="https://www.maisonaffluency.com/trade/orders">Open order workspace</a></p></div>`,
      }, admin),
    ]);

    return json({ orderId: order.id, orderRef, status: "pending_po_review" });
  } catch (error) {
    console.error("[create-purchase-order] error", error);
    return json({ error: "Unable to submit the purchase order." }, 500);
  }
});