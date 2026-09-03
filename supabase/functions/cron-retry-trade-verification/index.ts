// Retries trade-application verifications that failed with a system error.
// Scheduled every 15 minutes by pg_cron; only picks up rows whose
// `next_retry_at` has elapsed. Bounded batch, idempotent per row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BATCH = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  const ok =
    (cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
    auth === `Bearer ${serviceKey}`;
  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: due, error } = await admin
    .from("trade_applications")
    .select("id")
    .eq("status", "system_retry")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let retried = 0;
  for (const row of due ?? []) {
    // Claim the row first so a concurrent run cannot pick it up again.
    const { data: claimed } = await admin
      .from("trade_applications")
      .update({ next_retry_at: null })
      .eq("id", row.id)
      .eq("status", "system_retry")
      .not("next_retry_at", "is", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-trade-application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret ?? "",
        },
        body: JSON.stringify({ application_id: row.id }),
      });
      retried++;
    } catch (e) {
      console.error("retry failed", row.id, e);
      await admin
        .from("trade_applications")
        .update({
          status: "flagged_for_review",
          last_verification_error: e instanceof Error ? e.message : "retry invocation failed",
        })
        .eq("id", row.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, due: due?.length ?? 0, retried }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
