import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@^2.108.2";
import { requireCronOrAdmin } from "../_shared/auth.ts";
import { checkInstagram, getMetaToken } from "../_shared/metaToken.ts";
import { retryWhenInstagramWorks } from "../_shared/instagramRetry.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = await requireCronOrAdmin(req, "retry-instagram-verification");
  if (!auth.ok) return json(auth.body, auth.status);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) return json({ error: "Expected an empty object" }, 400);
  } catch { return json({ error: "Expected an empty object" }, 400); }
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Backend unavailable" }, 500);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const check = await checkInstagram(await getMetaToken());
    const result = await retryWhenInstagramWorks(check.state, async () => {
      const { data, error } = await db.rpc("claim_instagram_verification_retries");
      if (error) throw error;
      return data ?? [];
    }, async (id) => {
      try {
        const response = await fetch(`${url}/functions/v1/analyze-studio-aesthetic`, {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trade_account_id: id, instagram_retry: true }), signal: AbortSignal.timeout(90000),
        });
        await response.text();
      } finally {
        await db.from("trade_accounts").update({ instagram_retry_claimed_at: null }).eq("id", id);
      }
    });
    // Continue remaining due work; claimed failures wait until tomorrow.
    if (result.attempted > 0) await db.rpc("instagram_retry_dispatch");
    return json({ ...result, connection: check.state });
  } catch { return json({ error: "Verification retry temporarily unavailable; studio scores unchanged" }, 503); }
});