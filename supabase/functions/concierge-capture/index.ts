// Concierge lead capture + invisible qualifier.
// Receives the first user turn from the AI Concierge (public or trade), runs a
// quick Lovable-AI extraction to pull name/city/intent/signals, writes a row to
// `concierge_leads`, and notifies the gallery inbox when the lead looks
// qualified.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ADMIN_EMAIL = "concierge@myaffluency.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  surface: z.enum(["public", "trade"]),
  session_id: z.string().min(8).max(128),
  first_message: z.string().trim().min(3).max(4000),
  name: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  path: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
});

// ---- Input validation helpers ----

function isGibberish(text: string): boolean {
  const chars = [...text.replace(/\s/g, "")];
  if (chars.length === 0) return true;
  const freq = new Map<string, number>();
  for (const c of chars) freq.set(c, (freq.get(c) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  if (maxFreq / chars.length > 0.5) return true;

  const words = text.toLowerCase().match(/\b\w{2,}\b/g) || [];
  let repeatStreak = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) repeatStreak++;
    else repeatStreak = 1;
    if (repeatStreak >= 4) return true;
  }

  const nonAlphaNum = (text.match(/[^\p{L}\p{N}\s]/gu) || []).length;
  if (nonAlphaNum / text.length > 0.35) return true;

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

const HIGH_VALUE_AREAS: { needle: string; city: string; country: string }[] = [
  // London
  { needle: "mayfair", city: "London", country: "United Kingdom" },
  { needle: "belgravia", city: "London", country: "United Kingdom" },
  { needle: "knightsbridge", city: "London", country: "United Kingdom" },
  { needle: "kensington", city: "London", country: "United Kingdom" },
  { needle: "chelsea", city: "London", country: "United Kingdom" },
  { needle: "notting hill", city: "London", country: "United Kingdom" },
  { needle: "holland park", city: "London", country: "United Kingdom" },
  // NYC
  { needle: "upper east side", city: "New York", country: "United States" },
  { needle: "upper west side", city: "New York", country: "United States" },
  { needle: "tribeca", city: "New York", country: "United States" },
  { needle: "soho", city: "New York", country: "United States" },
  { needle: "hamptons", city: "New York", country: "United States" },
  // Paris
  { needle: "7e", city: "Paris", country: "France" },
  { needle: "8e", city: "Paris", country: "France" },
  { needle: "16e", city: "Paris", country: "France" },
  { needle: "saint-germain", city: "Paris", country: "France" },
  // Other
  { needle: "monaco", city: "Monaco", country: "Monaco" },
  { needle: "monte carlo", city: "Monaco", country: "Monaco" },
  { needle: "the peak", city: "Hong Kong", country: "Hong Kong" },
  { needle: "mid-levels", city: "Hong Kong", country: "Hong Kong" },
  { needle: "repulse bay", city: "Hong Kong", country: "Hong Kong" },
  { needle: "palm jumeirah", city: "Dubai", country: "United Arab Emirates" },
  { needle: "emirates hills", city: "Dubai", country: "United Arab Emirates" },
  { needle: "bel air", city: "Los Angeles", country: "United States" },
  { needle: "beverly hills", city: "Los Angeles", country: "United States" },
  { needle: "holmby hills", city: "Los Angeles", country: "United States" },
  { needle: "miami beach", city: "Miami", country: "United States" },
  { needle: "aspen", city: "Aspen", country: "United States" },
  { needle: "district 9", city: "Singapore", country: "Singapore" },
  { needle: "district 10", city: "Singapore", country: "Singapore" },
  { needle: "district 11", city: "Singapore", country: "Singapore" },
  { needle: "sentosa cove", city: "Singapore", country: "Singapore" },
];

const HIGH_VALUE_CITIES = new Set([
  "london", "new york", "nyc", "paris", "monaco", "hong kong", "dubai",
  "los angeles", "la", "miami", "aspen", "singapore", "geneva", "zurich",
  "milan", "rome", "tokyo", "seoul", "doha", "abu dhabi", "riyadh",
]);

type Qualified = {
  name: string | null;
  city: string | null;
  country: string | null;
  intent: "sourcing" | "bespoke" | "project_ffe" | "general";
  signals: string[];
  qualified_score: number;
};

function heuristic(text: string): Qualified {
  const lc = text.toLowerCase();
  const signals: string[] = [];
  let city: string | null = null;
  let country: string | null = null;

  for (const a of HIGH_VALUE_AREAS) {
    if (lc.includes(a.needle)) {
      signals.push("high_value_location");
      city = a.city;
      country = a.country;
      break;
    }
  }
  if (!city) {
    for (const c of HIGH_VALUE_CITIES) {
      const re = new RegExp(`\\b${c.replace(/ /g, "\\s+")}\\b`, "i");
      if (re.test(text)) {
        city = c.replace(/\b\w/g, (m) => m.toUpperCase());
        if (!signals.includes("high_value_location")) signals.push("high_value_location");
        break;
      }
    }
  }

  const rooms = [
    "dining", "living", "bedroom", "study", "library", "entry", "foyer",
    "kitchen", "powder", "office", "townhouse", "penthouse", "villa",
    "apartment", "yacht", "chalet",
  ];
  for (const r of rooms) {
    if (new RegExp(`\\b${r}\\b`, "i").test(text)) {
      signals.push(`room_type:${r}`);
      break;
    }
  }

  if (/\b(?:£|\$|€|usd|gbp|eur|chf|aed|sgd)\s?[\d,]+/i.test(text) ||
      /\bbudget\b/i.test(text)) signals.push("budget_hint");
  if (/\b(commission|bespoke|custom|made[\s-]?to[\s-]?measure)\b/i.test(text)) {
    signals.push("bespoke_intent");
  }
  if (/\b(project|specifying|specify|fit[\s-]?out|ff&?e|schedule)\b/i.test(text)) {
    signals.push("project_intent");
  }

  let intent: Qualified["intent"] = "general";
  if (signals.includes("bespoke_intent")) intent = "bespoke";
  else if (signals.includes("project_intent")) intent = "project_ffe";
  else if (text.length > 20) intent = "sourcing";

  let score = 20;
  if (city) score += 25;
  if (signals.includes("high_value_location")) score += 25;
  if (signals.includes("budget_hint")) score += 15;
  if (signals.some((s) => s.startsWith("room_type:"))) score += 10;
  if (signals.includes("bespoke_intent")) score += 10;
  if (signals.includes("project_intent")) score += 10;
  if (text.length > 80) score += 5;
  score = Math.min(100, score);

  return { name: null, city, country, intent, signals: Array.from(new Set(signals)), qualified_score: score };
}

async function aiEnrich(text: string, base: Qualified): Promise<Qualified> {
  if (!LOVABLE_API_KEY) return base;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Extract structured info from a luxury design concierge intake message. Respond with strict JSON only, no prose.",
          },
          {
            role: "user",
            content:
              `Message:\n"""${text.slice(0, 2000)}"""\n\nReturn JSON with keys: name (string|null), city (string|null), country (string|null), intent ("sourcing"|"bespoke"|"project_ffe"|"general"). Use null when unsure. Do not invent.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!resp.ok) return base;
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 120) : base.name,
      city: typeof parsed.city === "string" && parsed.city.trim() ? parsed.city.trim().slice(0, 120) : base.city,
      country: typeof parsed.country === "string" && parsed.country.trim() ? parsed.country.trim().slice(0, 120) : base.country,
      intent: ["sourcing", "bespoke", "project_ffe", "general"].includes(parsed.intent) ? parsed.intent : base.intent,
      signals: base.signals,
      qualified_score: base.qualified_score,
    };
  } catch {
    return base;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const body = parsed.data;

  // Reject low-quality / spam input before running heuristic + AI enrichment.
  const v = validateMessage(body.first_message);
  if (!v.ok) {
    return new Response(JSON.stringify({ ok: false, rejected: true, reason: v.reason }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Identify trade users from their JWT (best-effort).
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    try {
      const { data } = await supabase.auth.getClaims(token);
      const sub = (data?.claims as { sub?: string } | null | undefined)?.sub;
      if (sub) userId = sub;
    } catch { /* anon */ }
  }

  // Dedupe: skip insert if we already captured this session in the last 24h.
  const { data: existing } = await supabase
    .from("concierge_leads")
    .select("id")
    .eq("session_id", body.session_id)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .limit(1);
  if (existing && existing.length > 0) {
    return new Response(JSON.stringify({ ok: true, deduped: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const base = heuristic(body.first_message);
  const enriched = await aiEnrich(body.first_message, base);

  const finalName = body.name?.trim() || enriched.name;
  const finalCity = body.city?.trim() || enriched.city;

  const ua = req.headers.get("user-agent") || null;

  const { data: row, error } = await supabase
    .from("concierge_leads")
    .insert({
      surface: body.surface,
      user_id: userId,
      session_id: body.session_id,
      name: finalName,
      city: finalCity,
      country: enriched.country,
      first_message: body.first_message,
      intent: enriched.intent,
      signals: enriched.signals,
      qualified_score: enriched.qualified_score,
      path: body.path ?? null,
      user_agent: ua,
      referrer: body.referrer ?? null,
    })
    .select("id, qualified_score, signals")
    .single();

  if (error) {
    console.error("[concierge-capture] insert failed", error);
    return new Response(JSON.stringify({ error: "db_insert_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Notify when qualified.
  const isHigh = enriched.signals.includes("high_value_location");
  const shouldNotify = isHigh || enriched.qualified_score >= 60;
  if (shouldNotify) {
    try {
      const subject = `Concierge lead — ${enriched.intent} — ${finalCity ?? "unknown city"} — score ${enriched.qualified_score}`;
      const message = [
        `Surface: ${body.surface}`,
        `Name: ${finalName ?? "(unknown)"}`,
        `City: ${finalCity ?? "(unknown)"}`,
        `Country: ${enriched.country ?? "(unknown)"}`,
        `Intent: ${enriched.intent}`,
        `Score: ${enriched.qualified_score}`,
        `Signals: ${enriched.signals.join(", ") || "(none)"}`,
        `Path: ${body.path ?? "—"}`,
        ``,
        `Message:`,
        body.first_message,
      ].join("\n");
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "inquiry-notification",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `concierge-lead-${row.id}`,
          templateData: {
            name: finalName ?? "Concierge visitor",
            firm: finalCity ?? "",
            company: enriched.country ?? "",
            email: "(no email — concierge intake)",
            phone: "",
            message,
            subject,
          },
        },
      });
      await supabase.from("concierge_leads").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      console.error("[concierge-capture] notify failed", e);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      lead_id: row.id,
      qualified_score: row.qualified_score,
      signals: row.signals,
      city: finalCity,
      country: enriched.country,
      intent: enriched.intent,
      name: finalName,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
