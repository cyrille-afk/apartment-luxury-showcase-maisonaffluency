// Public-facing AI concierge stream (anon visitors on /concierge).
// Minimal SSE chat endpoint with per-IP + per-session rate limiting.
// Does NOT expose catalog tools, RAG, or user-scoped data — those live on
// the authenticated /trade-concierge endpoint.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-concierge-surface, x-concierge-sid",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// In-memory fallback (only used if the DB rate-limit RPC errors out).
const memBuckets = new Map<string, { count: number; resetAt: number }>();
function memFallback(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = memBuckets.get(key);
  if (!b || b.resetAt <= now) {
    memBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true } as const;
  }
  if (b.count >= limit) return { ok: false, retryInSec: Math.ceil((b.resetAt - now) / 1000) } as const;
  b.count++;
  return { ok: true } as const;
}

// Persistent DB-backed rate limiter. Survives cold starts, prevents
// per-instance IP rotation, and enforces a true global cap.
async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const { data, error } = await sb.rpc("concierge_check_rate_limit", {
      _key: key,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      return { ok: false, retryInSec: row.retry_in ?? windowSeconds } as const;
    }
    return { ok: true } as const;
  } catch (e) {
    console.warn("[concierge-public-stream] rate-limit DB error, falling back to memory", e);
    return memFallback(key, limit, windowSeconds * 1000);
  }
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// ---- Input validation helpers ----

function isGibberish(text: string): boolean {
  // Repeated single character (>50% same char)
  const chars = [...text.replace(/\s/g, "")];
  if (chars.length === 0) return true;
  const freq = new Map<string, number>();
  for (const c of chars) freq.set(c, (freq.get(c) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  if (maxFreq / chars.length > 0.5) return true;

  // Same short word repeated 4+ times consecutively
  const words = text.toLowerCase().match(/\b\w{2,}\b/g) || [];
  let repeatStreak = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) repeatStreak++;
    else repeatStreak = 1;
    if (repeatStreak >= 4) return true;
  }

  // Excessive non-alphanumeric (>35%)
  const nonAlphaNum = (text.match(/[^\p{L}\p{N}\s]/gu) || []).length;
  if (nonAlphaNum / text.length > 0.35) return true;

  // Excessive ALL CAPS (>70% of alphabetic chars)
  const alpha = text.replace(/[^a-zA-Z]/g, "");
  if (alpha.length > 5) {
    const upper = (alpha.match(/[A-Z]/g) || []).length;
    if (upper / alpha.length > 0.7) return true;
  }

  return false;
}

function countUrls(text: string): number {
  return (text.match(/https?:\/\//gi) || []).length;
}

const SPAM_KEYWORDS = [
  "casino", "viagra", "cialis", "crypto giveaway", "free nft", "airdrop",
  "click here", "earn money fast", "make money online", "work from home",
  "lose weight fast", "debt relief", "loan approval", "credit repair",
  "hot singles", "adult site", "porn", "escort", "lottery winner",
  "claim your prize", "inheritance fund", "wire transfer", "bank account verify",
  "seo services", "web traffic", "buy followers",
];

function hasSpamPattern(text: string): boolean {
  const lc = text.toLowerCase();
  for (const kw of SPAM_KEYWORDS) {
    if (lc.includes(kw)) return true;
  }
  return false;
}

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

function validateMessage(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Message is empty." };
  if (trimmed.length < 3) return { ok: false, reason: "Message too short." };
  if (trimmed.length > 4000) return { ok: false, reason: "Message too long." };
  if (countUrls(trimmed) > 2) return { ok: false, reason: "Too many URLs." };
  if (isGibberish(trimmed)) return { ok: false, reason: "Message appears to be gibberish or low-quality input." };
  if (hasSpamPattern(trimmed)) return { ok: false, reason: "Message matches spam patterns." };
  return { ok: true };
}

// -----------------------------------

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

  // Require an authenticated Maison Affluency member. The /concierge page is
  // members-only client-side; enforce the same rule server-side so the endpoint
  // cannot be hit directly by anonymous or spoofed clients.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const logUnauthorized = async (reason: string) => {
    try {
      await sb.from("security_audit_events").insert({
        event_type: "concierge_unauthorized",
        source: "concierge-public-stream",
        ip: clientIp(req),
        details: {
          reason,
          user_agent: req.headers.get("user-agent") || null,
          referer: req.headers.get("referer") || null,
          sid: (req.headers.get("x-concierge-sid") || "").slice(0, 128) || null,
        },
      });
    } catch (e) {
      console.warn("[concierge-public-stream] audit log failed", e);
    }
  };
  if (!token) {
    await logUnauthorized("missing_token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { data, error } = await sb.auth.getClaims(token);
    const sub = (data?.claims as { sub?: string } | null | undefined)?.sub;
    if (error || !sub) {
      await logUnauthorized("invalid_claims");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    await logUnauthorized("claims_exception");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit by IP (60/hr), by client-supplied session id (15/hr),
  // and a global cap (2000/hr across all visitors) so the bill stays bounded.
  const globalRl = await rateLimit("pub-global", 2000, 3600);
  if (!globalRl.ok) {
    return new Response(JSON.stringify({ error: "Concierge is at capacity. Please try again shortly.", retry_in: globalRl.retryInSec }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const ip = clientIp(req);
  const ipRl = await rateLimit(`pub-ip:${ip}`, 60, 3600);
  if (!ipRl.ok) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_in: ipRl.retryInSec }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sid = (req.headers.get("x-concierge-sid") || "").slice(0, 128);
  if (sid) {
    const sidRl = await rateLimit(`pub-sid:${sid}`, 15, 3600);
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

  // Validate the latest user message (the one that just arrived).
  const latestUser = trimmed.slice().reverse().find((m: any) => m.role === "user");
  if (latestUser) {
    const v = validateMessage(latestUser.content);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.reason }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

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
