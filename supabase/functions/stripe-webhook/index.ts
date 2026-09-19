import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { loadStripeTestCreds } from "../_shared/stripeCreds.ts";
import { getStripe } from "../_shared/stripeClient.ts";
import { recordPurchaseOrdersPayable } from "../_shared/recordPurchaseOrdersPayable.ts";
import { formatCurrency } from "../_shared/transactional-email-templates/currency.ts";

const { stripe, creds } = await getStripe("auto");
const testCreds = await loadStripeTestCreds();

const endpointSecrets = [creds.webhookSecret, testCreds?.webhookSecret].filter(
  (s): s is string => Boolean(s),
);

/**
 * Sales funnel Kanban state machine.
 * A paid Stripe link carrying metadata.cardId flips its card to
 * "paid" (Awaiting Settlement) or "settled" (Conversions) when the
 * payment clears the expected total with zero balance remaining.
 */
async function settleFunnelCard(
  supabase: ReturnType<typeof createClient>,
  args: { cardId: string; sessionId?: string | null; paymentIntentId?: string | null; amountPaid: number },
) {
  try {
    let query = supabase
      .from("funnel_card_payments")
      .select("id, amount_cents, expected_total_cents, payment_kind, status")
      .eq("card_id", args.cardId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (args.sessionId) query = query.eq("stripe_session_id", args.sessionId);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[STRIPE-WEBHOOK] funnel card lookup failed:", error);
      return;
    }
    const row = rows?.[0];
    if (!row) {
      console.warn(`[STRIPE-WEBHOOK] No funnel card record for cardId ${args.cardId}`);
      return;
    }
    if (row.status === "paid" || row.status === "settled") return; // idempotent

    const expected = row.expected_total_cents ?? row.amount_cents ?? 0;
    const paid = args.amountPaid || row.amount_cents || 0;
    const fullySettled = row.payment_kind === "full" || (expected > 0 && paid >= expected);

    const { error: updErr } = await supabase
      .from("funnel_card_payments")
      .update({
        status: fullySettled ? "settled" : "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: args.paymentIntentId ?? null,
      })
      .eq("id", row.id);
    if (updErr) console.error("[STRIPE-WEBHOOK] funnel card update failed:", updErr);
    else console.log(`[STRIPE-WEBHOOK] Funnel card ${args.cardId} → ${fullySettled ? "settled" : "paid"}`);
  } catch (e) {
    console.error("[STRIPE-WEBHOOK] settleFunnelCard error:", e);
  }
}

/**
 * Kill-switch: once a payment lands, every pending/scheduled reminder for that
 * quote (or card) is resolved and the automation is permanently paused.
 */
async function cancelFunnelReminders(
  supabase: ReturnType<typeof createClient>,
  entityIds: (string | null | undefined)[],
) {
  const ids = [...new Set(entityIds.filter(Boolean) as string[])];
  if (ids.length === 0) return;
  const types = ["quote_unpaid", "cart", "funnel_card"];
  try {
    for (const id of ids) {
      await supabase
        .from("funnel_reminder_log")
        .update({ resolved_at: new Date().toISOString(), resolved_reason: "payment_received" })
        .in("entity_type", types)
        .eq("entity_id", id)
        .is("resolved_at", null);

      await supabase.from("funnel_reminder_pauses").upsert(
        types.map((entity_type) => ({
          entity_type,
          entity_id: id,
          paused: true,
          reason: "payment_received",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "entity_type,entity_id" },
      );
    }
    console.log(`[STRIPE-WEBHOOK] Reminders cancelled for ${ids.join(", ")}`);
  } catch (e) {
    console.error("[STRIPE-WEBHOOK] cancelFunnelReminders error:", e);
  }
}

async function notifyInternalPaymentReceived(
  supabase: ReturnType<typeof createClient>,
  args: {
    label: string;
    amountCents: number;
    currency: string;
    payerEmail?: string | null;
    quoteRef?: string | null;
    cardStage?: string | null;
    paymentIntentId: string;
    sessionId?: string | null;
  },
) {
  try {
    const fmt = (cents: number) =>
      ((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const templateData = {
      label: args.label,
      amountFormatted: fmt(args.amountCents),
      currency: (args.currency || "USD").toUpperCase(),
      payerEmail: args.payerEmail ?? null,
      quoteRef: args.quoteRef ?? null,
      cardStage: args.cardStage ?? null,
      sessionId: args.sessionId ?? args.paymentIntentId,
      paidAt: new Date().toISOString(),
      funnelUrl: "https://www.maisonaffluency.com/trade/admin/sales-funnel",
    };

    const idempotencyKey = `funnel-payment-received-internal-${args.paymentIntentId}`;
    const recipients = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];

    for (const recipient of recipients) {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "funnel-payment-received-internal",
          recipientEmail: recipient,
          idempotencyKey,
          templateData,
        },
      });
      if (error) {
        console.error(`[STRIPE-WEBHOOK] internal payment notify failed for ${recipient}:`, error);
      }
    }
  } catch (e) {
    console.error("[STRIPE-WEBHOOK] notifyInternalPaymentReceived error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event | null = null;
  let lastErr: Error | null = null;
  for (const secret of endpointSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch (err: any) {
      lastErr = err;
    }
  }
  if (!event) {
    console.error("Webhook signature verification failed:", lastErr?.message);
    return new Response(`Webhook Error: ${lastErr?.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quote_id;
    const paymentType = session.metadata?.payment_type || "deposit";
    const userIdMeta = session.metadata?.user_id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ===== Sales funnel card payment (metadata.cardId) =====
    const funnelCardId = session.metadata?.cardId;
    if (funnelCardId && session.payment_status === "paid") {
      await settleFunnelCard(supabase, {
        cardId: funnelCardId,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        amountPaid: session.amount_total ?? 0,
      });

      const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
      await notifyInternalPaymentReceived(supabase, {
        label: session.metadata?.label || "Sales Funnel payment",
        amountCents: session.amount_total ?? 0,
        currency: session.currency || "USD",
        payerEmail: session.customer_details?.email || session.customer_email || null,
        quoteRef: session.metadata?.quote_id || null,
        cardStage: session.metadata?.card_stage || null,
        paymentIntentId: piId,
        sessionId: session.id,
      });
    }

    // ===== Guest quote payment link handler =====
    if (paymentType === "guest_quote_link") {
      const linkId = session.metadata?.payment_link_id;
      if (linkId && session.payment_status === "paid") {
        const { error: linkErr } = await supabase
          .from("quote_payment_links")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", linkId);
        if (linkErr) console.error("[STRIPE-WEBHOOK] payment link update failed:", linkErr);

        if (quoteId) {
          const { error: qErr } = await supabase
            .from("trade_quotes")
            .update({ status: "deposit_paid" })
            .eq("id", quoteId);
          if (qErr) console.error("[STRIPE-WEBHOOK] quote status update failed:", qErr);
        }
      }
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ===== Cart order handler =====
    if (paymentType === "cart_order") {
      const orderId = session.metadata?.order_id;
      if (orderId && session.payment_status === "paid") {
        const { error: orderErr } = await supabase
          .from("shop_orders")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", orderId);
        if (orderErr) console.error("[STRIPE-WEBHOOK] shop order update failed:", orderErr);
        else console.log(`[STRIPE-WEBHOOK] Shop order ${orderId} marked as paid`);

        // ===== Wholesale accounts payable (merchant-of-record) =====
        try {
          const payoutResult = await recordPurchaseOrdersPayable(supabase, {
            orderId,
            tradeProgramId: session.metadata?.trade_program_id ?? null,
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          });
          if ("error" in payoutResult) {
            console.error("[STRIPE-WEBHOOK] wholesale payable failed:", payoutResult.error);
          } else {
            console.log(`[STRIPE-WEBHOOK] Wholesale payable rows: ${payoutResult.inserted}`);
          }
        } catch (e) {
          console.error("[STRIPE-WEBHOOK] commission split error:", e);
        }

        // ===== Purchase order dispatch (one PO per designer in the cart) =====
        try {
          const { error: poErr } = await supabase.functions.invoke(
            "dispatch-designer-purchase-orders",
            { body: { orderId, stripeSessionId: session.id } },
          );
          if (poErr) console.error("[STRIPE-WEBHOOK] PO dispatch failed:", poErr);
          else console.log(`[STRIPE-WEBHOOK] Purchase orders dispatched for ${orderId}`);
        } catch (e) {
          console.error("[STRIPE-WEBHOOK] PO dispatch error:", e);
        }

        // Order-received confirmation ("Under Review by Paris Logistics").
        // Idempotent via the order_ref key — Stripe retries cannot duplicate it.
        try {
          const { data: order } = await supabase
            .from("shop_orders")
            .select("order_ref, email, full_name, currency, subtotal_cents, shipping_cents, total_cents")
            .eq("id", orderId)
            .single();
          const { data: items } = await supabase
            .from("shop_order_items")
            .select("title, designer_name, finish_label, quantity, unit_price_cents")
            .eq("order_id", orderId);

          if (order?.email) {
            const currency = order.currency || "usd";

            const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "order-received",
                recipientEmail: order.email,
                idempotencyKey: `order-received-${order.order_ref}`,
                templateData: {
                  recipientName: order.full_name ?? "",
                  orderRef: order.order_ref,
                  firstItemTitle: items?.[0]?.title ?? "Order",
                  currency,
                  items: (items ?? []).map((l: any) => ({
                    title: l.title,
                    designerName: l.designer_name,
                    configuration: l.finish_label,
                    quantity: l.quantity,
                    priceFormatted: formatCurrency(l.unit_price_cents, currency),
                  })),
                  subtotalFormatted: formatCurrency(order.subtotal_cents, currency),
                  shippingFormatted: Number(order.shipping_cents) > 0 ? formatCurrency(order.shipping_cents, currency) : null,
                  taxLineFormatted: `${formatCurrency(0, currency)} (Zero-rated at checkout / Deferred to Border Customs)`,
                  totalFormatted: formatCurrency(order.total_cents, currency),
                },
              },
            });
            if (mailErr) console.error("[STRIPE-WEBHOOK] order-received email failed:", mailErr);
          }
        } catch (e) {
          console.error("[STRIPE-WEBHOOK] order-received email error:", e);
        }
      }
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    // ===== Direct checkout handler (single product, no cart) =====
    if (paymentType === "direct_checkout") {
      if (session.payment_status === "paid") {
        // Resolve the product name: metadata first, then the Stripe line items.
        let productName = session.metadata?.product_title || "";
        if (!productName) {
          try {
            const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            productName = items.data[0]?.description || "Order";
          } catch (e) {
            console.error("[STRIPE-WEBHOOK] listLineItems failed:", e);
            productName = "Order";
          }
        }

        const customerEmail =
          session.customer_details?.email || session.customer_email || null;

        const { error: orderErr } = await supabase.from("orders").insert({
          user_id: userIdMeta || null,
          product_name: productName,
          selected_finish: session.metadata?.selected_finish || null,
          customer_email: customerEmail,
          transaction_id: session.id,
          amount_total: session.amount_total ?? 0,
          currency: (session.currency || "usd").toLowerCase(),
          status: "paid",
        });

        // 23505 = duplicate transaction_id → Stripe retry, safe to ignore.
        if (orderErr && (orderErr as any).code !== "23505") {
          console.error("[STRIPE-WEBHOOK] order insert failed:", orderErr);
        } else if (!orderErr) {
          console.log(`[STRIPE-WEBHOOK] Order recorded for session ${session.id}`);
        }
      }
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    // ===== FF&E unlock handler =====
    if (paymentType === "ffe_unlock" && session.payment_status === "paid" && userIdMeta) {
      console.log(`[STRIPE-WEBHOOK] FF&E unlock paid for user ${userIdMeta}, session ${session.id}`);
      const { data: ent, error: entErr } = await supabase
        .from("ffe_entitlements")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_session_id", session.id)
        .select("id, user_id, amount_cents, currency")
        .single();

      if (entErr) {
        console.error("[STRIPE-WEBHOOK] FF&E entitlement update failed:", entErr);
      } else if (ent) {
        // Insert matching credit (idempotent via source_ref)
        const { data: existingCredit } = await supabase
          .from("trade_credits")
          .select("id")
          .eq("source", "ffe_unlock")
          .eq("source_ref", ent.id)
          .maybeSingle();
        if (!existingCredit) {
          await supabase.from("trade_credits").insert({
            user_id: ent.user_id,
            source: "ffe_unlock",
            source_ref: ent.id,
            amount_cents: ent.amount_cents,
            currency: ent.currency,
            status: "available",
          });
          console.log(`[STRIPE-WEBHOOK] Credit created for user ${ent.user_id}: ${ent.amount_cents}c`);
        }
      }
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }

    if (quoteId && session.payment_status === "paid") {
      console.log(`[STRIPE-WEBHOOK] Payment completed for quote ${quoteId}, type: ${paymentType}`);

      if (paymentType === "deposit") {
        // Deposit paid → move to deposit_paid (allow from priced or confirmed,
        // matching create-quote-payment which accepts both).
        const { error } = await supabase
          .from("trade_quotes")
          .update({ status: "deposit_paid", updated_at: new Date().toISOString() })
          .eq("id", quoteId)
          .in("status", ["priced", "confirmed"]);

        if (error) {
          console.error(`[STRIPE-WEBHOOK] Failed to update quote ${quoteId}:`, error);
        } else {
          console.log(`[STRIPE-WEBHOOK] Quote ${quoteId} marked as deposit_paid`);
        }
      } else if (paymentType === "balance") {
        // Balance paid → move to paid
        const { error } = await supabase
          .from("trade_quotes")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", quoteId)
          .eq("status", "deposit_paid");

        if (error) {
          console.error(`[STRIPE-WEBHOOK] Failed to update quote ${quoteId}:`, error);
        } else {
          console.log(`[STRIPE-WEBHOOK] Quote ${quoteId} marked as paid`);
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // On-site (single page) checkout — PaymentIntent based.
  // ---------------------------------------------------------------------
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    if (pi.metadata?.cardId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await settleFunnelCard(supabase, {
        cardId: pi.metadata.cardId,
        paymentIntentId: pi.id,
        amountPaid: pi.amount_received ?? pi.amount ?? 0,
      });

      await notifyInternalPaymentReceived(supabase, {
        label: pi.metadata?.label || "Sales Funnel payment",
        amountCents: pi.amount_received ?? pi.amount ?? 0,
        currency: pi.currency || "USD",
        payerEmail: pi.receipt_email || null,
        quoteRef: pi.metadata?.quote_id || null,
        cardStage: pi.metadata?.card_stage || null,
        paymentIntentId: pi.id,
      });
    }

    if (pi.metadata?.payment_type === "onsite_checkout") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const { error: orderErr } = await supabase.from("orders").insert({
        user_id: pi.metadata?.user_id || null,
        product_name: pi.metadata?.product_title || "Order",
        selected_finish: pi.metadata?.selected_finish || null,
        customer_email: pi.receipt_email || null,
        transaction_id: pi.id,
        amount_total: pi.amount_received ?? pi.amount ?? 0,
        currency: (pi.currency || "usd").toLowerCase(),
        status: "paid",
      });

      // 23505 = duplicate transaction_id → Stripe retry, safe to ignore.
      if (orderErr && (orderErr as any).code !== "23505") {
        console.error("[STRIPE-WEBHOOK] onsite order insert failed:", orderErr);
      } else if (!orderErr) {
        console.log(`[STRIPE-WEBHOOK] On-site order recorded for ${pi.id}`);
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }
  }

  // ---------------------------------------------------------------------
  // Connect transfer & payment failure handling for the dual-billing flow.
  // We notify every admin of the affected studio so they can take action.
  // ---------------------------------------------------------------------
  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "transfer.failed" ||
    event.type === "transfer.reversed" ||
    event.type === "account.updated"
  ) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
      let studioId: string | null = null;
      let quoteId: string | null = null;
      let title = "Payout issue";
      let message = "Stripe reported an issue with a recent payout.";
      let type = "payout_alert";
      let link: string | null = null;
      const metadata: Record<string, unknown> = { stripe_event: event.type, stripe_event_id: event.id };

      if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object as Stripe.PaymentIntent;
        quoteId = (pi.metadata?.quote_id as string) || null;
        const reason = pi.last_payment_error?.message || "Payment was declined.";
        title = "Quote payment failed";
        message = `Stripe declined the ${pi.metadata?.payment_type ?? "deposit"} payment: ${reason}`;
        type = "quote_payment_failed";
        metadata.last_payment_error = pi.last_payment_error || null;
        metadata.amount = pi.amount;
        metadata.currency = pi.currency;
        if (quoteId) {
          const { data: q } = await supabase
            .from("trade_quotes").select("studio_id").eq("id", quoteId).maybeSingle();
          studioId = (q?.studio_id as string) || null;
          link = `/trade/quotes?quote=${quoteId}`;
        }
      } else if (event.type === "transfer.failed" || event.type === "transfer.reversed") {
        const tr = event.data.object as Stripe.Transfer;
        const destinationAccount = typeof tr.destination === "string" ? tr.destination : tr.destination?.id ?? null;
        title = event.type === "transfer.failed" ? "Designer payout failed" : "Designer payout reversed";
        message =
          event.type === "transfer.failed"
            ? "A commission transfer to your Stripe Connect account did not go through. Please review your account in Studio Settings → Payouts."
            : "A commission transfer to your Stripe Connect account was reversed.";
        type = "payout_failed";
        metadata.destination_account = destinationAccount;
        metadata.amount = tr.amount;
        metadata.currency = tr.currency;
        if (destinationAccount) {
          const { data: payout } = await supabase
            .from("studio_payout_accounts")
            .select("studio_id")
            .eq("stripe_connect_account_id", destinationAccount)
            .maybeSingle();
          studioId = (payout?.studio_id as string) || null;
          link = "/trade/studio/settings#payouts";
        }
      } else if (event.type === "account.updated") {
        const acct = event.data.object as Stripe.Account;
        // Sync our cached connect status whenever Stripe pushes a change.
        // IMPORTANT: status values must match what stripe-connect-status writes
        // and what PayoutAccountsSection STATUS_META maps:
        //   active | pending | restricted | not_started
        const status: "active" | "pending" | "restricted" =
          acct.charges_enabled && acct.payouts_enabled && acct.details_submitted
            ? "active"
            : acct.requirements?.disabled_reason
              ? "restricted"
              : "pending";

        const { data: payout } = await supabase
          .from("studio_payout_accounts")
          .select("id, studio_id, stripe_connect_status")
          .eq("stripe_connect_account_id", acct.id)
          .maybeSingle();

        if (payout) {
          studioId = payout.studio_id as string;
          const prev = payout.stripe_connect_status;
          if (prev !== status) {
            await supabase
              .from("studio_payout_accounts")
              .update({ stripe_connect_status: status, updated_at: new Date().toISOString() })
              .eq("id", payout.id);
          }

          // Only notify on degradations (restricted) or first verification.
          if (status === "restricted") {
            title = "Stripe account needs attention";
            message =
              acct.requirements?.disabled_reason
                ? `Stripe restricted your payout account: ${acct.requirements.disabled_reason}. Resolve in Studio Settings → Payouts.`
                : "Stripe restricted your payout account. Please review the requirements in Studio Settings → Payouts.";
            type = "payout_account_restricted";
            link = "/trade/studio/settings#payouts";
            metadata.requirements = acct.requirements ?? null;
          } else if (status === "active" && prev !== "active") {
            title = "Payout account verified";
            message = "Your Stripe Connect account is ready to receive commissions.";
            type = "payout_account_verified";
            link = "/trade/studio/settings#payouts";
          } else {
            // No-op notification — silent sync only.
            return new Response(JSON.stringify({ received: true, synced: true }), {
              headers: { "Content-Type": "application/json" }, status: 200,
            });
          }
        }
      }

      if (studioId) {
        // Notify every admin of the studio.
        const { data: admins } = await supabase
          .from("studio_members")
          .select("user_id")
          .eq("studio_id", studioId)
          .in("role", ["owner", "admin"]);

        const recipients = (admins ?? []).map((a: any) => a.user_id as string).filter(Boolean);
        if (recipients.length > 0) {
          const rows = recipients.map((uid) => ({
            user_id: uid,
            type,
            title,
            message,
            link,
            is_read: false,
            metadata: { ...metadata, quote_id: quoteId, studio_id: studioId },
          }));
          const { error: notifErr } = await supabase.from("notifications").insert(rows);
          if (notifErr) console.error("[STRIPE-WEBHOOK] Failed to insert notifications:", notifErr);
          else console.log(`[STRIPE-WEBHOOK] Notified ${recipients.length} admin(s) for studio ${studioId} (${type})`);
        } else {
          console.warn(`[STRIPE-WEBHOOK] Studio ${studioId} has no admins to notify (${type})`);
        }
      } else {
        console.warn(`[STRIPE-WEBHOOK] Could not resolve studio for event ${event.type} ${event.id}`);
      }
    } catch (err) {
      console.error("[STRIPE-WEBHOOK] Failure handler error:", err);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

