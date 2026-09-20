import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveAccountDiscount } from "../_shared/accountDiscount.ts";
import { resolveTaxTreatment, normaliseBuyerTaxId } from "../_shared/taxRules.ts";
import { verifyVatNumber } from "../_shared/vatValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Creates a PaymentIntent for the on-site (single page) luxury checkout.
 * Auth is optional: signed-in buyers are linked to their user id, guests are
 * identified by the email captured in the checkout form.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ---- Optional auth ----
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      );
      const { data: claimsData } = await supabaseAnon.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const claims = claimsData?.claims as Record<string, unknown> | undefined;
      if (claims?.sub) {
        userId = String(claims.sub);
        userEmail = typeof claims.email === "string" ? claims.email : null;
      }
    }

    // ---- Input validation ----
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" && body.email.includes("@")
        ? body.email.trim().slice(0, 200)
        : userEmail;
    const currency = (typeof body?.currency === "string" ? body.currency : "usd").toLowerCase();
    // PayNow is Singapore-only and SGD-only (Stripe requirement). Bank
    // transfers (customer_balance) are not available to SG merchants, so SGD
    // orders get PayNow instead.
    const requestedMethod: "card" | "paynow" = body?.paymentMethod === "paynow" ? "paynow" : "card";
    if (requestedMethod === "paynow" && currency !== "sgd") {
      return json({ error: "PayNow is available only on SGD-priced orders." }, 400);
    }

    type Item = { title: string; designer: string; finish: string; unitAmount: number; quantity: number };
    const parseItem = (raw: any): Item | null => {
      const title = typeof raw?.title === "string" ? raw.title.trim() : "";
      const price = Number(raw?.price);
      if (!title || title.length > 200) return null;
      if (!Number.isFinite(price) || price <= 0) return null;
      return {
        title: title.slice(0, 200),
        designer: typeof raw?.designer === "string" ? raw.designer.trim().slice(0, 120) : "",
        finish: typeof raw?.selectedFinish === "string" ? raw.selectedFinish.trim().slice(0, 250) : "",
        // `price` arrives as a major-unit amount (e.g. 7513) → convert to cents.
        unitAmount: Math.round(price * 100),
        quantity: Math.min(20, Math.max(1, Math.round(Number(raw?.quantity) || 1))),
      };
    };

    // Multi-line orders send `items`; single-line callers keep the flat shape.
    const rawItems = Array.isArray(body?.items) && body.items.length ? body.items : [body];
    if (rawItems.length > 20) return json({ error: "Too many items in one order." }, 400);
    const items: Item[] = [];
    for (const raw of rawItems) {
      const item = parseItem(raw);
      if (!item) return json({ error: "A valid product title and price are required." }, 400);
      items.push(item);
    }

    // ---- Account-level tier discount (re-derived server-side) ----
    // Clients send gross prices; the discount is applied here so the amount
    // charged equals the discounted total shown in the order summary.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { pct: discountPct, label: discountLabel } = await resolveAccountDiscount(
      supabaseAdmin,
      userId,
    );
    // The discount is applied ONCE at cart level (never per unit): rounding a
    // per-line discount drifts by a few cents against the client-side total
    // and trips the checkout guardrail.
    const grossAmount = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
    const discountCents = discountPct > 0 ? Math.round(grossAmount * discountPct) : 0;
    const goodsAmount = grossAmount - discountCents;

    // ---- Shipping (opt-in only) ----
    // Shipping is "To be Quoted by Advisor" until the buyer explicitly confirms
    // an advisor-issued quote. No estimate is ever invented server-side.
    const shippingConfirmed = body?.shippingConfirmed === true;
    const rawShipping = Number(body?.shippingCents);
    const shippingCents =
      shippingConfirmed && Number.isFinite(rawShipping) && rawShipping > 0
        ? Math.round(rawShipping)
        : 0;
    if (shippingCents > 5_000_000) return json({ error: "Shipping amount out of range." }, 400);
    const shippingLabel =
      typeof body?.shippingLabel === "string" ? body.shippingLabel.trim().slice(0, 120) : "";

    // ---- Consumption tax (configurable rules) ----
    // A rule applies only when the destination country AND the order currency
    // match (see _shared/taxRules.ts). Everything else is zero-rated.
    const shippingCountry =
      typeof body?.shippingCountry === "string" ? body.shippingCountry.trim().toUpperCase() : "";
    const buyerType =
      typeof body?.buyerType === "string" && body.buyerType.toLowerCase() === "business"
        ? "business"
        : "private";
    // Accept the generic field, keeping the legacy Singapore-only name working.
    const buyerTaxId = normaliseBuyerTaxId(
      typeof body?.buyerTaxId === "string"
        ? body.buyerTaxId
        : typeof body?.buyerGstNumber === "string"
          ? body.buyerGstNumber
          : "",
    );

    // GST and the collected order total use the full CIF value: goods + freight.
    // Until freight is confirmed, the validated country estimate is the delivery
    // amount shown and collected at checkout.
    const rawEstimatedFreight = Number(body?.estimatedFreightCents);
    const estimatedFreightCents =
      !shippingConfirmed && Number.isFinite(rawEstimatedFreight) && rawEstimatedFreight > 0
        ? Math.round(rawEstimatedFreight)
        : 0;
    if (estimatedFreightCents > 5_000_000) return json({ error: "Shipping amount out of range." }, 400);
    const freightForTaxCents = shippingCents > 0 ? shippingCents : estimatedFreightCents;
    // The client's "verified" flag is never trusted: re-run the authority check
    // here. Invalid, unsupported or unavailable ⇒ standard destination VAT.
    const verification =
      buyerType === "business" && buyerTaxId
        ? await verifyVatNumber(buyerTaxId, shippingCountry)
        : null;
    // Per-line customs manifest (HS6 + duty rate + origin) bound to the order.
    const customsLines = Array.isArray(body?.customsLines)
      ? (body.customsLines as unknown[]).slice(0, 200).map((raw) => {
          const l = (raw ?? {}) as Record<string, unknown>;
          return {
            hs6Code: typeof l.hs6Code === "string" ? l.hs6Code.slice(0, 12) : null,
            dutyRate: Number.isFinite(Number(l.dutyRate)) ? Number(l.dutyRate) : null,
            originCountry:
              typeof l.originCountry === "string" ? l.originCountry.slice(0, 40) : null,
            lineTotalCents: Math.max(0, Math.round(Number(l.lineTotalCents) || 0)),
          };
        })
      : [];
    // One engine decides the rate, wording and registration for every country.
    const treatment = resolveTaxTreatment({
      country: shippingCountry,
      currency,
      buyerType,
      buyerTaxId,
      buyerTaxIdVerified: verification?.valid === true,
      goodsCents: goodsAmount,
      shippingCents: freightForTaxCents,
      goodsEurCents: currency.toUpperCase() === "EUR" ? goodsAmount : null,
      shipFromCountry:
        typeof body?.shipFromCountry === "string" ? body.shipFromCountry.toUpperCase() : null,
      lines: customsLines,
    });
    const taxCents = treatment.taxCents;
    const taxLabel = treatment.label;
    const clearanceFeeCents = treatment.clearanceFeeCents;

    const deliveryCents = shippingCents > 0 ? shippingCents : estimatedFreightCents;
    const deliveryTerm = body?.incoterm === "DDP" ? "DDP" : body?.incoterm === "DDU" ? "DDU" : "";
    const metadataCents = (value: unknown) => {
      const parsed = Math.round(Number(value) || 0);
      return String(Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100_000_000) : 0);
    };
    // Checkout presents whole-currency rows. Charge their exact displayed sum
    // so the action label, bank-wire amount, invoice, and PaymentIntent agree.
    const roundDollar = (cents: number) => Math.round(cents / 100) * 100;
    const amount =
      roundDollar(goodsAmount) +
      roundDollar(deliveryCents) +
      roundDollar(taxCents) +
      roundDollar(clearanceFeeCents);
    if (amount < 100 || amount > 100_000_00 * 100) return json({ error: "Price out of range." }, 400);

    // ---- Deposit / balance split ----------------------------------------
    // High-value orders rarely clear on a corporate card in one charge. The
    // buyer may settle a deposit by card now; the balance is invoiced and
    // settled by bank transfer. Only the two published plans are honoured.
    const requestedDeposit = Number(body?.depositPct);
    const depositPct = requestedDeposit === 0.3 || requestedDeposit === 0.5 ? requestedDeposit : 0;
    const chargeAmount = depositPct > 0 ? roundDollar(Math.round(amount * depositPct)) : amount;
    const balanceDueCents = amount - chargeAmount;
    if (chargeAmount < 100) return json({ error: "Deposit amount out of range." }, 400);



    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments are not configured." }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse an existing Stripe customer when we already know this buyer.
    let customerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data.length
        ? customers.data[0].id
        : (await stripe.customers.create({ email })).id;
    }

    const first = items[0];
    const description = items
      .map((i) => `${[i.designer, i.title].filter(Boolean).join(" — ")} ×${i.quantity}`)
      .join(" | ")
      .slice(0, 300);

    const metadata: Record<string, string> = {
        payment_type: "onsite_checkout",
        user_id: userId ?? "",
        product_title: first.title,
        designer: first.designer,
        selected_finish: first.finish,
        quantity: String(items.reduce((n, i) => n + i.quantity, 0)),
        item_count: String(items.length),
        discount_pct: String(discountPct),
        discount_label: discountLabel ?? "",
        shipping_cents: String(shippingCents),
        estimated_freight_cents: String(estimatedFreightCents),
        delivery_cents: String(deliveryCents),
        shipping_label: shippingLabel,
        shipping_country: shippingCountry,
        delivery_term: deliveryTerm,
        import_duty_cents: metadataCents(body?.importDutyCents),
        import_tax_cents: metadataCents(body?.importVatCents),
        import_clearance_cents: metadataCents(body?.importClearanceCents),
        ddp_handling_cents: metadataCents(body?.ddpHandlingCents),
        import_total_cents: metadataCents(body?.importTotalCents),
        deferred_import_cents: metadataCents(body?.deferredImportCents),
        tax_cents: String(taxCents),
        tax_label: taxLabel ?? "",
        buyer_type: buyerType,
        buyer_gst_number: buyerTaxId,
        // FX lock the basket was priced at in the browser, so the rate the
        // buyer agreed to is recoverable from the payment itself.
        fx_locked_at: typeof body?.fxLockedAt === "string" ? body.fxLockedAt.slice(0, 40) : "",
        fx_locked_rates:
          body?.fxLockedRates && typeof body.fxLockedRates === "object"
            ? JSON.stringify(body.fxLockedRates).slice(0, 400)
            : "",
        buyer_tax_id: buyerTaxId,
        buyer_tax_country: treatment.countryIso ?? "",
        tax_treatment: treatment.treatment,
        tax_rate: String(treatment.rate),
        tax_statement: (treatment.statement ?? "").slice(0, 400),
        merchant_tax_registration: treatment.registrationLine ?? "",
        merchant_tax_identifier: treatment.merchantTaxIdentifier ?? "",
        buyer_tax_id_verified: String(treatment.buyerTaxIdVerified),
        buyer_tax_id_verification_source: verification?.source ?? "",
        customs_clearance_cents: String(clearanceFeeCents),
        estimated_duty_cents: String(treatment.dutyCents),
        requires_ddp_clearance: String(treatment.requiresDdpClearance),
        ship_from_country: treatment.shipFromCountry ?? "",
        payment_plan: depositPct > 0 ? `deposit_${Math.round(depositPct * 100)}` : "full",
        order_total_cents: String(amount),
        deposit_charged_cents: String(chargeAmount),
        balance_due_cents: String(balanceDueCents),
        line_items: JSON.stringify(


          items.map((i) => ({ t: i.title, f: i.finish, u: i.unitAmount, q: i.quantity })),
        ).slice(0, 500),
    };

    // Reuse the open PaymentIntent when the buyer only added a confirmed
    // shipping quote; fall back to a fresh intent when it can no longer change.
    const reuseId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : "";
    let intent: Stripe.PaymentIntent | null = null;
    if (reuseId.startsWith("pi_")) {
      try {
        const existing = await stripe.paymentIntents.retrieve(reuseId);
        const updatable =
          existing.status === "requires_payment_method" ||
          existing.status === "requires_confirmation";
        const sameMethod = (existing.payment_method_types ?? []).includes(requestedMethod);
        if (updatable && existing.currency === currency && sameMethod) {
          intent = await stripe.paymentIntents.update(reuseId, {
            amount: chargeAmount,
            description,
            metadata,
          });
        }
      } catch (_e) {
        intent = null;
      }
    }

    if (!intent) {
      intent = await stripe.paymentIntents.create({
        amount: chargeAmount,
        currency,
        customer: customerId,
        receipt_email: email ?? undefined,
        // Card-only keeps the Stripe pane clean: no auto-expanded Link pane.
        // Apple Pay / Google Pay still surface as card wallets via the
        // ExpressCheckoutElement, so express buyers are not affected.
        payment_method_types: [requestedMethod],
        description,
        metadata,
      });
    }


    return json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      depositPct,
      chargedAmount: chargeAmount,
      balanceDueCents,
      currency,
      paymentMethod: requestedMethod,
      discountPct,
      discountLabel,
      goodsAmount,
      shippingCents,
      estimatedFreightCents,
      deliveryCents,
      shippingLabel,
      taxCents,
      taxLabel,
      taxRate: treatment.rate,
      taxTreatment: treatment.treatment,
      taxStatement: treatment.statement,
      buyerTaxId: treatment.buyerTaxId,

    });
  } catch (err) {
    console.error("[create-payment-intent] error", err);
    return json({ error: "Unable to start checkout." }, 500);
  }
});
