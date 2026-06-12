// Scheduled job: removes expired rows from `public.concierge_rate_limits`
// so the table does not grow unbounded. Runs daily.
// Authenticated via a shared CRON_SECRET header (set as a Supabase secret)
// or a Bearer token equal to the SERVICE_ROLE_KEY (pg_cron calls).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: accept either CRON_SECRET header (manual triggers) or
  // a Bearer token equal to the SERVICE_ROLE_KEY (pg_cron calls).
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  const provided = req.headers.get("x-cron-secret");
  const ok =
    (cronSecret && provided === cronSecret) ||
    (serviceKey && auth === `Bearer ${serviceKey}`);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data, error } = await sb
      .from("concierge_rate_limits")
      .delete()
      .lte("reset_at", new Date().toISOString())
      .select("count", { count: "exact", head: true });

    if (error) throw error;

    const report = {
      ok: true,
      ran_at: new Date().toISOString(),
      removed: data ?? 0,
    };
    console.log("[cron-cleanup-concierge-rate-limits]", JSON.stringify(report));
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cron-cleanup-concierge-rate-limits] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
