import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, rateLimit } from "../_shared/auth.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { modelFor } from "../_shared/aiModels.ts";

const TRANSLATE_MODEL = modelFor("cheap");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAME: Record<string, string> = {
  en: "English",
  id: "Indonesian (Bahasa Indonesia)",
  th: "Thai",
  zh: "Simplified Chinese",
};

const MAX_TEXT_LEN = 5000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rl = rateLimit(`translate:${auth.userId}`, 60, 60_000);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryInSec) },
      });
    }

    const { text, lang } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > MAX_TEXT_LEN) {
      return new Response(JSON.stringify({ error: `text too long (max ${MAX_TEXT_LEN})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = LANG_NAME[lang];
    if (!target) {
      return new Response(JSON.stringify({ error: "unsupported lang" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing api key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a professional translator. Translate the user's text into ${target}.

RULES:
- Preserve all Markdown formatting (line breaks, italics with _underscores_, bold, lists).
- Preserve all template placeholders exactly as written, including: {first_name_comma}, {first_name}, {concierge_name}. Do not translate or modify them.
- Keep brand names like "Maison Affluency", "AI Trade Concierge", "Concierge", "tearsheet", "brief", "Showroom" in the original language unless naturally translated.
- Output ONLY the translated text — no quotes, no commentary, no preamble.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "translation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    logAiUsage({ feature: "translate-text", model: "google/gemini-2.5-flash", usage: data?.usage }).catch(() => {});
    const translated = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-text error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
