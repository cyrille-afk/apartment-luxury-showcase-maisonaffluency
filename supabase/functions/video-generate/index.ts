// Walkthrough video guard. Checks tier/credits server-side before any render.
// mode "status" → access summary only. mode "render" → consume (if needed), call the
// render service, refund on any failure. While VIDEO_RENDER_WEBHOOK_URL is unset the
// render is a dry run and nothing is charged.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { currentMonth, decideVideoAccess, goldIncludedLeft, normalizeTier, VIDEO_PASS_PRICE_EUR } from "../_shared/videoAccess.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Invalid session" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "render" ? "render" : "status";

    const [{ data: roles }, { data: profile }, { data: credits }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", userId),
      db.from("profiles").select("trade_tier").eq("id", userId).maybeSingle(),
      db.from("video_credits").select("video_tokens_balance, gold_month, gold_month_used").eq("user_id", userId).maybeSingle(),
    ]);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
    const isTrade = isAdmin || (roles ?? []).some((r: { role: string }) => r.role === "trade_user");
    if (!isTrade) return json({ error: "Trade access required" }, 403);
    const month = currentMonth();
    const input = {
      isAdmin, tier: normalizeTier(profile?.trade_tier), month,
      balance: credits?.video_tokens_balance ?? 0,
      goldMonth: credits?.gold_month ?? null, goldMonthUsed: credits?.gold_month_used ?? 0,
    };
    const access = decideVideoAccess(input);
    const summary = {
      tier: input.tier, isAdmin, balance: input.balance,
      goldIncludedLeft: input.tier === "gold" ? goldIncludedLeft(input) : 0,
      unlimited: access.allowed && access.consumes === null,
      allowed: access.allowed,
    };
    if (mode === "status") return json(summary);

    if (!access.allowed) {
      return json({ error: "purchase_required", message: `A Single Video Pass (€${VIDEO_PASS_PRICE_EUR}) is required to render this walkthrough.`, ...summary }, 403);
    }

    const webhook = Deno.env.get("VIDEO_RENDER_WEBHOOK_URL");
    const payload = body?.payload;
    if (!payload || typeof payload !== "object") return json({ error: "Missing render payload" }, 400);

    let consumed: string | null = null;
    if (access.consumes) {
      const { data: src, error } = await db.rpc("consume_video_credit", { _user: userId, _gold: input.tier === "gold", _month: month });
      if (error) throw error;
      if (!src) return json({ error: "purchase_required", message: "No video credits left.", ...summary }, 403);
      consumed = src as string;
    }
    try {
      let response: unknown;
      if (webhook) {
        const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Render service failed (${res.status})`);
        response = await res.json().catch(() => null);
      } else {
        // Mock render service until a real provider is connected.
        if (body?.simulate_failure === true) throw new Error("Mock render service failed");
        response = { mock: true, job_id: `mock_${crypto.randomUUID()}`, status: "queued", eta_seconds: 90 };
      }
      return json({ status: "queued", charged: !!consumed, source: consumed, mock: !webhook, response });
    } catch (e) {
      if (consumed) await db.rpc("refund_video_credit", { _user: userId, _source: consumed });
      return json({ error: e instanceof Error ? e.message : "Render failed", refunded: !!consumed }, 502);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
