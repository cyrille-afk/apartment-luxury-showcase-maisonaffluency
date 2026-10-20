import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@^2.108.2";
import { GRAPH, checkInstagram, getMetaToken } from "../_shared/metaToken.ts";
import { parseMetaTokenInput } from "../_shared/metaTokenInput.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const user = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: claims } = await user.auth.getClaims(auth.replace(/^Bearer\s+/i, ""));
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return json({ error: "Invalid session" }, 401);
  const { data: isAdmin } = await user.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!isAdmin) return json({ error: "Admin access required" }, 403);

  let body: { action?: string; token?: string } = {};
  try { body = await req.json(); } catch { /* status */ }

  if (body.action === "save") {
    const input = parseMetaTokenInput(body.token);
    if (input.error) return json({ saved: false, error: input.error });
    let token = input.token;
    const appId = Deno.env.get("META_APP_ID"), secret = Deno.env.get("META_APP_SECRET");
    if (appId && secret) {
      const ex = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null);
      if (ex?.access_token) token = ex.access_token;
    }
    const check = await checkInstagram(token);
    if (check.state !== "working") return json({ saved: false, check });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { error } = await admin.from("integration_tokens").upsert({
      provider: "meta", access_token: token, expires_at: check.expiresAt ?? null,
      account_label: check.igUsername ?? null, updated_by: uid, updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);
    return json({ saved: true, check });
  }

  const check = await checkInstagram(await getMetaToken());
  if (check.state === "working") {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (key) {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.rpc("instagram_retry_dispatch");
    }
  }
  return json({ check });
});
