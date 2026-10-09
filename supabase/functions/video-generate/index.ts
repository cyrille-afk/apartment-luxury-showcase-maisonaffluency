// Walkthrough video guard. Checks tier/credits server-side before any render.
// mode "status" → access summary only. mode "render" → consume (if needed), call the
// render service, refund on any failure. While VIDEO_RENDER_WEBHOOK_URL is unset the
// render uses a built-in mock service (credits still consumed, refunded on failure).
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
    const mode = body?.mode === "render" ? "render" : body?.mode === "ping" ? "ping"
      : body?.mode === "poll" ? "poll" : body?.mode === "history" ? "history" : "status";

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

    // The signed-in user's own render history, newest first.
    if (mode === "history") {
      const { data: jobs } = await db.from("video_render_jobs")
        .select("job_id, state, video_url, failure, created_at, quality, render_seconds, cost_usd")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(25);
      return json({ jobs: jobs ?? [] });
    }

    // Admin-only key check. Probes a generation id that cannot exist: a valid key gets 404
    // (authenticated, nothing found), an invalid key gets 401/403. Nothing is created or billed.
    if (mode === "ping") {
      const lumaKey = Deno.env.get("LUMA_API_KEY");
      if (!lumaKey) return json({ provider: "luma", configured: false });
      const res = await fetch("https://agents.lumalabs.ai/v1/generations/luma-auth-probe", {
        headers: { authorization: `Bearer ${lumaKey}` },
      });
      const detail = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      return json({
        provider: "luma", configured: true, ok: res.ok || res.status === 404, status: res.status, detail,
      });
    }

    // Admin-only render lookup (no render, no charge). The id must be a UUID before it is used.
    if (mode === "poll") {
      const lumaKey = Deno.env.get("LUMA_API_KEY");
      if (!lumaKey) return json({ provider: "luma", configured: false });
      const id = String(body?.job_id ?? "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        return json({ error: "Invalid job id" }, 400);
      }
      // Studios may poll only their own renders (token minted at render time for this user + job).
      if (!isAdmin && String(body?.poll_token ?? "") !== await pollToken(userId, id)) {
        return json({ error: "Forbidden" }, 403);
      }
      const res = await fetch(`https://agents.lumalabs.ai/v1/generations/${id}`, {
        headers: { authorization: `Bearer ${lumaKey}` },
      });
      const data = await res.json().catch(() => null);
      const state = data?.state ?? null;
      const failure = data?.failure_reason ?? data?.failure_code ?? null;
      const outputs = Array.isArray(data?.output) ? data.output.map((o: { url?: string }) => o?.url ?? null) : null;
      const videoUrl = outputs?.find((u: string | null) => typeof u === "string" && u) ?? null;
      if (state === "completed" || state === "failed" || videoUrl) {
        const now = new Date();
        const { data: existing } = await db.from("video_render_jobs")
          .select("created_at, quality").eq("job_id", id).eq("user_id", userId).maybeSingle();
        const patch: Record<string, unknown> = {
          state: state ?? "completed", video_url: videoUrl, failure, updated_at: now.toISOString(),
        };
        if (existing?.created_at) {
          patch.render_seconds = Math.max(0, Math.round((now.getTime() - new Date(existing.created_at).getTime()) / 100) / 10);
        }
        // Luma bills per generation by resolution; record the billed figure for the quality used.
        const billed = { "540p": 0.35, "720p": 0.6, "1080p": 1.2 }[String(existing?.quality ?? "720p")] ?? 0.6;
        if ((state ?? "completed") === "completed" || videoUrl) patch.cost_usd = billed;
        await db.from("video_render_jobs").update(patch).eq("job_id", id).eq("user_id", userId);
      }
      return json({ ok: res.ok, status: res.status, state, failure, outputs });
    }


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
      const lumaKey = Deno.env.get("LUMA_API_KEY");
      const quality = ["540p", "720p", "1080p"].includes(String(body?.quality)) ? String(body.quality) : "720p";
      if (lumaKey) {
        response = await executeLumaVideoGeneration(db, lumaKey, userId, body?.snapshot, String((payload as { brief?: string }).brief ?? ""), quality);
      } else if (webhook) {
        const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Render service failed (${res.status})`);
        response = await res.json().catch(() => null);
      } else {
        // Mock render service until a real provider is connected.
        if (body?.simulate_failure === true) throw new Error("Mock render service failed");
        response = { mock: true, job_id: `mock_${crypto.randomUUID()}`, status: "queued", eta_seconds: 90 };
      }
      const jid = (response as { job_id?: string } | null)?.job_id;
      const poll_token = lumaKey && jid ? await pollToken(userId, jid) : undefined;
      if (lumaKey && jid) {
        await db.from("video_render_jobs").insert({ user_id: userId, job_id: jid, state: "queued", quality });
      }
      return json({ status: "queued", poll_token, charged: !!consumed, source: consumed, mock: !webhook && !lumaKey, provider: lumaKey ? "luma" : webhook ? "webhook" : "mock", response });
    } catch (e) {
      if (consumed) await db.rpc("refund_video_credit", { _user: userId, _source: consumed });
      return json({ error: e instanceof Error ? e.message : "Render failed", refunded: !!consumed }, 502);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});

// Luma Agents API (Ray 3.2 video). Snapshot (canvas JPEG data URL) is stored privately and
// passed as a 1-hour signed URL start frame. Any throw here triggers the credit refund above.
async function executeLumaVideoGeneration(
  db: ReturnType<typeof createClient>, key: string, userId: string, snapshot: unknown, brief: string,
  resolution: "540p" | "720p" | "1080p" | string = "720p",
) {
  let startFrame: Record<string, unknown> | undefined;
  if (typeof snapshot === "string" && snapshot.startsWith("data:image/jpeg;base64,")) {
    const b64 = snapshot.slice(23);
    if (b64.length > 6_000_000) throw new Error("Snapshot too large");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `video-snapshots/${userId}/${crypto.randomUUID()}.jpg`;
    const up = await db.storage.from("trade-private").upload(path, bytes, { contentType: "image/jpeg" });
    if (up.error) throw new Error(`Snapshot upload failed: ${up.error.message}`);
    const { data: signed, error } = await db.storage.from("trade-private").createSignedUrl(path, 3600);
    if (error || !signed) throw new Error("Snapshot link failed");
    startFrame = { url: signed.signedUrl };
  }
  const res = await fetch("https://agents.lumalabs.ai/v1/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      model: "ray-3.2",
      type: "video",
      prompt: `Cinematic interior design walkthrough film, ${brief.slice(0, 1500)}. Ultra-luxury living environment, magazine-ready bounce lighting, soft ray-traced shadows drifting across furniture fabrics, 8k resolution, photorealistic textures, smooth steadicam tracking movement.`,
      aspect_ratio: "16:9",
      video: {
        resolution,
        duration: "5s",
        ...(startFrame ? { start_frame: startFrame } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Luma API error (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { job_id: data.id, status: data.state ?? "queued" };
}

async function pollToken(userId: string, jobId: string) {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${userId}:${jobId}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
