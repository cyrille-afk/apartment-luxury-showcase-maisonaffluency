import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
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
        const status =
          acct.charges_enabled && acct.payouts_enabled
            ? "verified"
            : acct.requirements?.disabled_reason
              ? "restricted"
              : "onboarding";

        const { data: payout } = await supabase
          .from("studio_payout_accounts")
          .select("id, studio_id, stripe_connect_status")
          .eq("stripe_connect_account_id", acct.id)
          .maybeSingle();

        if (payout) {
          studioId = payout.studio_id as string;
          if (payout.stripe_connect_status !== status) {
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
          } else if (status === "verified" && payout.stripe_connect_status !== "verified") {
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
          .eq("role", "admin");

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

