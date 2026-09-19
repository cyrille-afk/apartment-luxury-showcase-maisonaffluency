/**
 * notify-payment-alerts
 * ---------------------
 * Asynchronous notification worker for cleared payments. Invoked only by
 * `process-webhook-events` (never by Stripe directly), so Slack/Twilio/Resend
 * latency can no longer delay the Stripe webhook acknowledgement.
 *
 * Body: { kind: "internal_payment" | "deposit_cleared", args: {...} }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  notifyDepositCleared,
  notifyInternalPaymentReceived,
  type DepositClearedArgs,
  type InternalPaymentArgs,
} from "../_shared/paymentAlerts.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  let payload: { kind?: string; args?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const kind = payload?.kind;
  const args = payload?.args;
  if (!args || typeof args !== "object") return json({ error: "args is required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (kind === "internal_payment") {
      const a = args as unknown as InternalPaymentArgs;
      if (!a.paymentIntentId) return json({ error: "paymentIntentId is required" }, 400);
      await notifyInternalPaymentReceived(supabase, a);
      return json({ ok: true, kind });
    }

    if (kind === "deposit_cleared") {
      const a = args as unknown as DepositClearedArgs;
      if (!a.quoteId || !a.sessionId) return json({ error: "quoteId and sessionId are required" }, 400);
      await notifyDepositCleared(supabase, a);
      return json({ ok: true, kind });
    }

    return json({ error: `Unknown alert kind: ${kind}` }, 400);
  } catch (e) {
    console.error("[NOTIFY-PAYMENT-ALERTS] failed:", e);
    // 500 → the queue worker retries this event with backoff.
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
