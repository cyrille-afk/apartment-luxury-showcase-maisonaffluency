// Scheduled job: removes any legacy `assets/backups/*` objects from the
// public assets bucket and reports the count of remaining items.
// Authenticated via a shared CRON_SECRET header (set as a Supabase secret).
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

  async function listAll(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await sb.storage.from("assets").list(prefix, {
        limit: 1000, offset,
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) out.push(...await listAll(path));
        else out.push(path);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
    return out;
  }

  try {
    const files = await listAll("backups");
    let removed = 0;
    for (let i = 0; i < files.length; i += 100) {
      const batch = files.slice(i, i + 100);
      const { error } = await sb.storage.from("assets").remove(batch);
      if (error) throw error;
      removed += batch.length;
    }
    // Re-list to confirm
    const remaining = (await listAll("backups")).length;

    const report = {
      ok: true,
      ran_at: new Date().toISOString(),
      removed,
      remaining,
    };
    console.log("[cron-cleanup-public-backups]", JSON.stringify(report));
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cron-cleanup-public-backups] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
