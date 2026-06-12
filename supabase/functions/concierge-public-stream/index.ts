// Public-facing AI concierge stream (anon visitors on /concierge).
// Minimal SSE chat endpoint with per-IP + per-session rate limiting.
// Does NOT expose catalog tools, RAG, or user-scoped data — those live on
// the authenticated /trade-concierge endpoint.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-concierge-surface, x-concierge-sid",
};

// In-memory rate limiter (per edge-instance, best-effort).
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true } as const;
  }
  if (b.count >= limit) {
    return { ok: false, retryInSec: Math.ceil((b.resetAt - now) / 1000) } as const;
  }
  b.count++;
  return { ok: true } as const;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

const SYSTEM_PROMPT = `You are the private concierge for Maison Affluency — a collectible-design gallery representing world-class designers (Andrée Putman, Pierre Yovanovitch, Man of Parts, India Mahdavi, Alexander Lamont and many others). You speak to discerning private collectors and interior designers.

Voice: warm, confident, elite, never sycophantic. Short paragraphs. British English. Never reveal you are an AI or expose internal notes/profiles.

You can: source exceptional artisan and collectible objects, discuss designers and provenance, gather a project brief (room, address/city, style direction, timeline, budget posture), and explain that we ship white-glove worldwide from European ateliers (~99% of pieces ship from Europe, not Singapore).

You can NOT: quote firm prices, commit to lead times, or browse the live catalogue (that requires our trade portal). When a visitor asks for pricing or to see specific pieces, invite them to share their email so our director can follow up with a private selection and indicative pricing. Public prices are shown as "Price on Request" by design.

Never mention competitors. Never invent designers, pieces, or prices.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit by IP (60/hr) and by client-supplied session id (15/hr).
  const ip = clientIp(req);
  const ipRl = rateLimit(`pub-ip:${ip}`, 60, 60 * 60_000);
  if (!ipRl.ok) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_in: ipRl.retryInSec }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sid = (req.headers.get("x-concierge-sid") || "").slice(0, 128);
  if (sid) {
    const sidRl = rateLimit(`pub-sid:${sid}`, 15, 60 * 60_000);
    if (!sidRl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_in: sidRl.retryInSec }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: { messages?: unknown };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Trim history + sanitize roles/content.
  const trimmed = messages.slice(-10).map((m: any) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: typeof m?.content === "string" ? m.content.slice(0, 4000) : "",
  })).filter((m: any) => m.content);

  const upstream = await fetch(LOVABLE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
      stream: true,
      max_completion_tokens: 800,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 402 ? 402 : upstream.status === 429 ? 429 : 502;
    const error = status === 402
      ? "AI credits exhausted. Please contact the gallery directly."
      : status === 429
        ? "Concierge is momentarily busy. Please try again in a moment."
        : "Concierge temporarily unavailable.";
    return new Response(JSON.stringify({ error }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pass the upstream SSE stream straight through with CORS headers.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
