// Client -> Server -> Realtime handoff endpoint for the trade concierge.
//
// The trade concierge SSE stream (`trade-concierge`) already gives us
// server -> client push, and `_resume.ts` mirrors lifecycle events onto the
// `concierge:${stream_id}` Realtime topic. This function completes the loop:
// it lets the browser POST lightweight state changes ("the user just locked
// the brief", "finishes locked", "product selected", "proposal dismissed")
// so that:
//   1. other tabs / auxiliary UI bound to `concierge:${stream_id}` observe
//      them in near real time via Realtime broadcast, and
//   2. we persist an audit row into `trade_concierge_actions` for post-hoc
//      inspection and analytics.
//
// The endpoint is intentionally tiny: no LLM, no catalog access, no side
// effects on tearsheets or quotes. It validates ownership of the stream
// session and echoes the event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENTS = new Set([
  "brief_locked",
  "product_selected",
  "finishes_locked",
  "proposal_dismissed",
  "tearsheet_opened",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ---- Auth: validate the user JWT ------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;

  // ---- Parse + validate body -----------------------------------------
  let body: { stream_id?: unknown; event?: unknown; payload?: unknown };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const streamId = typeof body.stream_id === "string" ? body.stream_id.trim() : "";
  const event = typeof body.event === "string" ? body.event.trim() : "";
  const payload = (body.payload && typeof body.payload === "object") ? body.payload as Record<string, unknown> : {};
  if (!streamId || !event) {
    return new Response(JSON.stringify({ error: "stream_id and event are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!ALLOWED_EVENTS.has(event)) {
    return new Response(JSON.stringify({ error: `event must be one of: ${[...ALLOWED_EVENTS].join(", ")}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- Verify the user owns this stream session ----------------------
  const service = createClient(supabaseUrl, serviceKey);
  const { data: session, error: sessErr } = await service
    .from("concierge_stream_sessions")
    .select("stream_id, user_id")
    .eq("stream_id", streamId)
    .maybeSingle();
  if (sessErr) {
    return new Response(JSON.stringify({ error: "Session lookup failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!session || session.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Stream session not found for this user" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- Broadcast on `concierge:${stream_id}` -------------------------
  // Fire-and-forget: Realtime is the fast side-channel, the DB row is the
  // durable record. We don't fail the request if broadcast is unreachable.
  const broadcast = fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [{
        topic: `concierge:${streamId}`,
        event,
        payload: { ...payload, stream_id: streamId, user_id: userId, ts: Date.now() },
        private: true,
      }],
    }),
  }).catch((e) => {
    console.warn("[handoff] broadcast failed:", e instanceof Error ? e.message : e);
  });

  // ---- Audit row -----------------------------------------------------
  const audit = service.from("trade_concierge_actions").insert({
    user_id: userId,
    tool: `handoff:${event}`,
    args: { stream_id: streamId, payload },
    status: "handoff",
  }).then(({ error }: { error: unknown }) => {
    if (error) console.warn("[handoff] audit insert failed:", (error as { message?: string }).message);
  });

  await Promise.allSettled([broadcast, audit]);

  return new Response(JSON.stringify({ ok: true, stream_id: streamId, event }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
