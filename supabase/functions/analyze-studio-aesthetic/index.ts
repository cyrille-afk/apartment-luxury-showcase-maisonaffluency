// Studio Aesthetic DNA worker.
//
// Given a trade_account_id, scrapes the applicant's Instagram profile or website
// (Firecrawl), collects portfolio images, runs a Vision AI analysis via the
// Lovable AI Gateway, and writes the result to `studio_aesthetic_dna`.
// Invoked by `trade-program-signup` (service role) on step-3 completion, or by
// an admin from the Trade Applications queue (re-run).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { modelFor } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = modelFor("balanced");
const MAX_ATTEMPTS = 3;
const MAX_IMAGES = 6;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function resolveSourceUrl(ref: string | null): string | null {
  if (!ref) return null;
  const v = ref.trim();
  if (v.startsWith("@")) return `https://www.instagram.com/${v.slice(1)}/`;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

async function scrape(url: string): Promise<{ text: string; images: string[] }> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  const images = new Set<string>();
  let text = "";
  if (key) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: false, timeout: 30000 }),
      });
      if (res.ok) {
        const d = (await res.json())?.data ?? {};
        text = String(d.markdown ?? "").slice(0, 4000);
        const og = d.metadata?.ogImage ?? d.metadata?.["og:image"];
        if (typeof og === "string") images.add(og);
        const html = String(d.html ?? "");
        for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
          const src = m[1];
          if (/^https:\/\//.test(src) && !/\.svg(\?|$)|sprite|logo|icon|avatar/i.test(src)) images.add(src);
          if (images.size >= MAX_IMAGES * 2) break;
        }
      } else {
        console.error("firecrawl failed", res.status, (await res.text()).slice(0, 300));
      }
    } catch (e) {
      console.error("firecrawl error", e);
    }
  }
  return { text, images: [...images].slice(0, MAX_IMAGES) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isInternal = req.headers.get("Authorization") === `Bearer ${serviceKey}`;
  if (!isInternal) {
    const auth = await requireAdmin(req, "analyze-studio-aesthetic");
    if (!auth.ok) return json(auth.body, auth.status);
  }

  let body: { trade_account_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const id = String(body.trade_account_id ?? "");
  if (!UUID_RE.test(id)) return json({ error: "trade_account_id required" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  const { data: account } = await supabase
    .from("trade_accounts").select("id, studio_name, website_or_ig").eq("id", id).maybeSingle();
  if (!account) return json({ error: "Trade account not found" }, 404);

  const { data: dna } = await supabase
    .from("studio_aesthetic_dna").select("status, attempts").eq("trade_account_id", id).maybeSingle();
  if (dna?.status === "processing") return json({ ok: true, skipped: "already processing" });
  if (isInternal && (dna?.attempts ?? 0) >= MAX_ATTEMPTS) return json({ ok: false, skipped: "attempt cap" });

  const sourceUrl = resolveSourceUrl(account.website_or_ig);
  await supabase.from("studio_aesthetic_dna").upsert({
    trade_account_id: id, status: "processing", source_url: sourceUrl,
    attempts: (dna?.attempts ?? 0) + 1, error: null,
  }, { onConflict: "trade_account_id" });

  const fail = async (error: string, status = 200) => {
    await supabase.from("studio_aesthetic_dna").update({ status: "failed", error: error.slice(0, 1000) }).eq("trade_account_id", id);
    return json({ ok: false, error }, status);
  };

  if (!sourceUrl) return fail("No website or Instagram handle supplied");

  const { text, images } = await scrape(sourceUrl);
  if (!text && images.length === 0) return fail("Could not read the website / Instagram profile");

  const { data: roster } = await supabase
    .from("designers").select("slug, name, specialty").eq("status", "published").limit(150);
  const rosterLines = (roster ?? []).map((d: any) => `- ${d.slug} | ${d.name}${d.specialty ? ` | ${d.specialty}` : ""}`).join("\n");

  const prompt = [
    "You profile interior design studios applying to a luxury collectible-design trade platform.",
    `Studio: ${account.studio_name ?? "unknown"}`,
    `Source: ${sourceUrl}`,
    `Page text: ${text || "unavailable"}`,
    "The attached images are from the studio's portfolio / Instagram.",
    "Our designer roster (slug | name | specialty):",
    rosterLines,
    "Return JSON only:",
    '{"aesthetic_label":string (2-6 words),"aesthetic_summary":string (2-3 sentences),"dominant_tones":string[] (3-5),"historical_affinities":string[] (2-4 designers/movements),"materials":string[] (3-6),"matches":[{"slug":string,"rationale":string}] (up to 3, roster slugs only)}',
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const url of images) content.push({ type: "image_url", image_url: { url } });

  const aiRes = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], response_format: { type: "json_object" } }),
  });
  if (!aiRes.ok) {
    const t = (await aiRes.text()).slice(0, 500);
    console.error("gateway error", aiRes.status, t);
    // Terminal: 402/403 credits/policy; 429 retry later by admin re-run.
    return fail(`AI analysis failed (${aiRes.status})`);
  }
  const raw = (await aiRes.json())?.choices?.[0]?.message?.content ?? "";
  let parsed: any;
  try { parsed = JSON.parse(String(raw).replace(/^```(json)?|```$/g, "").trim()); }
  catch { return fail("AI returned an unreadable analysis"); }

  const slugs = new Set((roster ?? []).map((d: any) => d.slug));
  const arr = (v: unknown) => Array.isArray(v) ? v.map(String).slice(0, 8) : [];
  await supabase.from("studio_aesthetic_dna").update({
    status: "complete",
    image_urls: images,
    aesthetic_label: parsed.aesthetic_label ? String(parsed.aesthetic_label).slice(0, 120) : null,
    aesthetic_summary: parsed.aesthetic_summary ? String(parsed.aesthetic_summary).slice(0, 1500) : null,
    dominant_tones: arr(parsed.dominant_tones),
    historical_affinities: arr(parsed.historical_affinities),
    materials: arr(parsed.materials),
    predicted_designer_matches: (Array.isArray(parsed.matches) ? parsed.matches : []).filter((m: any) => slugs.has(m?.slug)).slice(0, 3),
    raw_analysis: parsed,
    model: MODEL,
    error: null,
    analyzed_at: new Date().toISOString(),
  }).eq("trade_account_id", id);

  return json({ ok: true });
});
