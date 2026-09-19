/**
 * Stripe event processor (async side of the payment pipeline).
 *
 * `stripe-webhook` only verifies the signature and records the event in
 * `public.webhook_events`. Everything below runs later, inside
 * `process-webhook-events`, where it can take as long as it needs and be
 * retried safely — Stripe has already received its 200 OK.
 *
 * Idempotency has two layers:
 *   1. the unique (provider, event_id) row — a redelivered Stripe event is
 *      never enqueued twice, so purchase orders cannot be duplicated;
 *   2. every individual action below is itself idempotent (status guards,
 *      unique transaction ids, deterministic email idempotency keys), so a
 *      partial failure can be retried without side effects.
 */

import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { recordPurchaseOrdersPayable } from "./recordPurchaseOrdersPayable.ts";
import { formatCurrency } from "./transactional-email-templates/currency.ts";

type Supa = ReturnType<typeof createClient>;

const LOG = "[WEBHOOK-WORKER]";

/** Fire a notification job. Alerts run in their own function so Slack/Twilio
 *  latency never shares a pool with PDF or database work. */
async function queueAlert(supabase: Supa, kind: string, args: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke("notify-payment-alerts", { body: { kind, args } });
  if (error) throw new Error(`notify-payment-alerts(${kind}) failed: ${error.message ?? error}`);
}

async function settleFunnelCard(
  supabase: Supa,
  args: { cardId: string; sessionId?: string | null; paymentIntentId?: string | null; amountPaid: number },
) {
  let query = supabase
    .from("funnel_card_payments")
    .select("id, amount_cents, expected_total_cents, payment_kind, status")
    .eq("card_id", args.cardId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.sessionId) query = query.eq("stripe_session_id", args.sessionId);

  const { data: rows, error } = await query;
  if (error) throw new Error(`funnel card lookup failed: ${error.message}`);
  const row = rows?.[0];
  if (!row) {
    console.warn(`${LOG} No funnel card record for cardId ${args.cardId}`);
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
  if (updErr) throw new Error(`funnel card update failed: ${updErr.message}`);
  console.log(`${LOG} Funnel card ${args.cardId} → ${fullySettled ? "settled" : "paid"}`);
}

/** Kill-switch: a cleared payment resolves and pauses every pending reminder. */
async function cancelFunnelReminders(supabase: Supa, entityIds: (string | null | undefined)[]) {
  const ids = [...new Set(entityIds.filter(Boolean) as string[])];
  if (ids.length === 0) return;
  const types = ["quote_unpaid", "cart", "funnel_card"];
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
  console.log(`${LOG} Reminders cancelled for ${ids.join(", ")}`);
}

async function sendOrderReceivedEmail(supabase: Supa, orderId: string) {
  const { data: order } = await supabase
    .from("shop_orders")
    .select("order_ref, email, full_name, currency, subtotal_cents, shipping_cents, total_cents")
    .eq("id", orderId)
    .single();
  if (!order?.email) return;

  const { data: items } = await supabase
    .from("shop_order_items")
    .select("title, designer_name, finish_label, quantity, unit_price_cents")
    .eq("order_id", orderId);

  const currency = order.currency || "usd";
  const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "order-received",
      recipientEmail: order.email,
      // Idempotent via the order_ref key — retries cannot duplicate it.
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
        taxLineFormatted: formatCurrency(Number(order.tax_cents ?? 0), currency),
        taxLabel: order.tax_label ?? "Taxes",
        taxStatement: order.tax_statement ?? null,
        totalFormatted: formatCurrency(order.total_cents, currency),
      },
    },
  });
  if (mailErr) throw new Error(`order-received email failed: ${mailErr.message ?? mailErr}`);
}

// =====================================================================
// Main entry point
// =====================================================================
export async function processStripeEvent(supabase: Supa, stripe: Stripe, event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quote_id;
    const paymentType = session.metadata?.payment_type || "deposit";
    const userIdMeta = session.metadata?.user_id;

    // ===== Sales funnel card payment (metadata.cardId) =====
    const funnelCardId = session.metadata?.cardId;
    if (funnelCardId && session.payment_status === "paid") {
      await settleFunnelCard(supabase, {
        cardId: funnelCardId,
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        amountPaid: session.amount_total ?? 0,
      });
      await cancelFunnelReminders(supabase, [funnelCardId, session.metadata?.quote_id]);

      const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
      await queueAlert(supabase, "internal_payment", {
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

    // ===== Guest quote payment link =====
    if (paymentType === "guest_quote_link") {
      const linkId = session.metadata?.payment_link_id;
      if (linkId && session.payment_status === "paid") {
        const { error: linkErr } = await supabase
          .from("quote_payment_links")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", linkId);
        if (linkErr) throw new Error(`payment link update failed: ${linkErr.message}`);

        if (quoteId) {
          const { error: qErr } = await supabase
            .from("trade_quotes")
            .update({ status: "deposit_paid" })
            .eq("id", quoteId);
          if (qErr) throw new Error(`quote status update failed: ${qErr.message}`);
          await cancelFunnelReminders(supabase, [quoteId]);
        }
      }
      return;
    }

    // ===== Cart order =====
    if (paymentType === "cart_order") {
      const orderId = session.metadata?.order_id;
      if (orderId && session.payment_status === "paid") {
        const { error: orderErr } = await supabase
          .from("shop_orders")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", orderId);
        if (orderErr) throw new Error(`shop order update failed: ${orderErr.message}`);

        // Wholesale accounts payable (merchant-of-record)
        const payoutResult = await recordPurchaseOrdersPayable(supabase, {
          orderId,
          tradeProgramId: session.metadata?.trade_program_id ?? null,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
        if ("error" in payoutResult) throw new Error(`wholesale payable failed: ${payoutResult.error}`);
        console.log(`${LOG} Wholesale payable rows: ${payoutResult.inserted}`);

        // Purchase-order dispatch (PDF generation lives in its own function,
        // so CPU-heavy rendering never shares this worker's pool).
        const { error: poErr } = await supabase.functions.invoke("dispatch-designer-purchase-orders", {
          body: { orderId, stripeSessionId: session.id },
        });
        if (poErr) throw new Error(`PO dispatch failed: ${poErr.message ?? poErr}`);
        console.log(`${LOG} Purchase orders dispatched for ${orderId}`);

        await sendOrderReceivedEmail(supabase, orderId);
      }
      return;
    }

    // ===== Direct checkout (single product, no cart) =====
    if (paymentType === "direct_checkout") {
      if (session.payment_status === "paid") {
        let productName = session.metadata?.product_title || "";
        if (!productName) {
          try {
            const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            productName = items.data[0]?.description || "Order";
          } catch (e) {
            console.error(`${LOG} listLineItems failed:`, e);
            productName = "Order";
          }
        }

        const { error: orderErr } = await supabase.from("orders").insert({
          user_id: userIdMeta || null,
          product_name: productName,
          selected_finish: session.metadata?.selected_finish || null,
          customer_email: session.customer_details?.email || session.customer_email || null,
          transaction_id: session.id,
          amount_total: session.amount_total ?? 0,
          currency: (session.currency || "usd").toLowerCase(),
          status: "paid",
        });
        // 23505 = duplicate transaction_id → replay, safe to ignore.
        if (orderErr && (orderErr as any).code !== "23505") {
          throw new Error(`order insert failed: ${orderErr.message}`);
        }
        console.log(`${LOG} Order recorded for session ${session.id}`);
      }
      return;
    }

    // ===== FF&E unlock =====
    if (paymentType === "ffe_unlock" && session.payment_status === "paid" && userIdMeta) {
      const { data: ent, error: entErr } = await supabase
        .from("ffe_entitlements")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_session_id", session.id)
        .select("id, user_id, amount_cents, currency")
        .single();
      if (entErr) throw new Error(`FF&E entitlement update failed: ${entErr.message}`);

      if (ent) {
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
          console.log(`${LOG} Credit created for user ${ent.user_id}: ${ent.amount_cents}c`);
        }
      }
      return;
    }

    // ===== Quote deposit / balance =====
    if (quoteId && session.payment_status === "paid") {
      await cancelFunnelReminders(supabase, [quoteId]);

      if (paymentType === "deposit") {
        const { error } = await supabase
          .from("trade_quotes")
          .update({ status: "deposit_paid", updated_at: new Date().toISOString() })
          .eq("id", quoteId)
          .in("status", ["priced", "confirmed"]);
        if (error) throw new Error(`quote ${quoteId} update failed: ${error.message}`);

        await queueAlert(supabase, "deposit_cleared", {
          quoteId,
          paymentKind: "deposit",
          amountCents: session.amount_total ?? 0,
          currency: session.currency || "USD",
          payerEmail: session.customer_details?.email || session.customer_email || null,
          sessionId: session.id,
          isLive: session.livemode === true,
        });
      } else if (paymentType === "balance") {
        const { error } = await supabase
          .from("trade_quotes")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", quoteId)
          .eq("status", "deposit_paid");
        if (error) throw new Error(`quote ${quoteId} update failed: ${error.message}`);

        await queueAlert(supabase, "deposit_cleared", {
          quoteId,
          paymentKind: "balance",
          amountCents: session.amount_total ?? 0,
          currency: session.currency || "USD",
          payerEmail: session.customer_details?.email || session.customer_email || null,
          sessionId: session.id,
          isLive: session.livemode === true,
        });
      }
    }
    return;
  }

  // -------------------------------------------------------------------
  // On-site (single page) checkout — PaymentIntent based.
  // -------------------------------------------------------------------
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    if (pi.metadata?.cardId) {
      await settleFunnelCard(supabase, {
        cardId: pi.metadata.cardId,
        paymentIntentId: pi.id,
        amountPaid: pi.amount_received ?? pi.amount ?? 0,
      });
      await cancelFunnelReminders(supabase, [pi.metadata.cardId, pi.metadata?.quote_id as string]);

      await queueAlert(supabase, "internal_payment", {
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
      if (orderErr && (orderErr as any).code !== "23505") {
        throw new Error(`onsite order insert failed: ${orderErr.message}`);
      }
      console.log(`${LOG} On-site order recorded for ${pi.id}`);
    }
    return;
  }

  // -------------------------------------------------------------------
  // Connect transfer & payment failure handling for the dual-billing flow.
  // -------------------------------------------------------------------
  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "transfer.failed" ||
    event.type === "transfer.reversed" ||
    event.type === "account.updated"
  ) {
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
      // status values must match stripe-connect-status / PayoutAccountsSection.
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

        if (status === "restricted") {
          title = "Stripe account needs attention";
          message = acct.requirements?.disabled_reason
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
          return; // silent sync only
        }
      }
    }

    if (studioId) {
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
        if (notifErr) throw new Error(`notifications insert failed: ${notifErr.message}`);
        console.log(`${LOG} Notified ${recipients.length} admin(s) for studio ${studioId} (${type})`);
      } else {
        console.warn(`${LOG} Studio ${studioId} has no admins to notify (${type})`);
      }
    } else {
      console.warn(`${LOG} Could not resolve studio for event ${event.type} ${event.id}`);
    }
  }
}
