import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const sids: string[] = Array.isArray(body?.sids)
      ? body.sids.filter((s: unknown) => typeof s === "string" && /^[A-Za-z0-9]{20,40}$/.test(s)).slice(0, 50)
      : [];
    if (sids.length === 0) return json({ statuses: [] });

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    if (!lovableKey || !twilioKey) return json({ error: "Twilio connection not configured" }, 500);

    const statuses = await Promise.all(
      sids.map(async (sid) => {
        try {
          const res = await fetch(`${TWILIO_GATEWAY_URL}/Messages/${sid}.json`, {
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": twilioKey,
            },
          });
          if (!res.ok) {
            const details = (await res.text()).slice(0, 400);
            return { sid, error: `Twilio ${res.status}: ${details}` };
          }
          const m = await res.json();
          return {
            sid,
            status: m?.status ?? null,
            error_code: m?.error_code ?? null,
            error_message: m?.error_message ?? null,
            to: m?.to ?? null,
            from: m?.from ?? null,
            date_sent: m?.date_sent ?? m?.date_updated ?? null,
          };
        } catch (err) {
          return { sid, error: String(err instanceof Error ? err.message : err).slice(0, 400) };
        }
      }),
    );

    return json({ statuses });
  } catch (err) {
    console.error("whatsapp-alert-status error:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
