// Portfolio aesthetic parsing worker.
//
// Claims a bounded batch of pending `prospect_studios` rows (single-flight via
// the SECURITY DEFINER `claim_prospect_enrichment` RPC + SKIP LOCKED), asks the
// Lovable AI Gateway to classify the studio's aesthetic and to pick the two
// Maison Affluency designers that studio would naturally specify, then writes
// the enriched analysis back onto the row.
//
// Invoked by `ingest-prospect-leads` with the service-role key, or manually by
// an admin from /admin/outbound.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { modelFor } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = modelFor("balanced");
const MAX_BATCH = 10;

type Prospect = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  business_email: string;
  website_url: string | null;
  website_summary: string | null;
  recent_design_keywords: string[] | null;
};

type DesignerRow = {
  id: string;
  name: string;
  slug: string;
  specialty: string | null;
  era: string | null;
  country: string | null;
};

type Analysis = {
  aesthetic_label: string;
  aesthetic_summary: string;
  matches: { slug: string; rationale: string }[];
};

/** Fetch the public website and reduce it to a short text summary. */
async function summariseWebsite(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "MaisonAffluencyBot/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 3000) || null;
  } catch {
    return null;
  }
}

function buildPrompt(p: Prospect, summary: string | null, roster: DesignerRow[]): string {
  const keywords = (p.recent_design_keywords ?? []).join(", ") || "none supplied";
  const rosterLines = roster
    .map((d) =>
      `- ${d.slug} | ${d.name}${d.specialty ? ` | ${d.specialty}` : ""}${
        d.era ? ` | ${d.era}` : ""
      }${d.country ? ` | ${d.country}` : ""}`,
    )
    .join("\n");

  return [
    "You profile interior design studios for a luxury trade platform.",
    "",
    `Studio: ${p.studio_name}`,
    `Founder: ${p.founder_name ?? "unknown"}`,
    `Website: ${p.website_url ?? "unknown"}`,
    `Recent design keywords: ${keywords}`,
    `Website summary: ${summary ?? "unavailable"}`,
    "",
    "Our designer roster (slug | name | specialty | era | country):",
    rosterLines,
    "",
    "Tasks:",
    "1. Name the studio's design aesthetic in 2-6 words (e.g. 'French Mid-Century Modern', 'High-End Minimalist Brutalism').",
    "2. Write 2-3 sentences describing their material language and the kind of pieces they specify.",
    "3. Choose exactly the 2 roster designers this studio would most naturally buy for their projects, with a one-sentence rationale each.",
    "",
    'Reply as JSON: {"aesthetic_label":string,"aesthetic_summary":string,"matches":[{"slug":string,"rationale":string},{"slug":string,"rationale":string}]}',
    "Only use slugs that appear in the roster above.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isInternal = req.headers.get("Authorization") === `Bearer ${serviceKey}`;
  if (!isInternal) {
    const auth = await requireAdmin(req, "enrich-prospect-aesthetics");
    if (!auth.ok) return json(auth.body, auth.status);
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  let body: { batchSize?: number; ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  // Bounded claim. Explicit ids (admin "re-analyse") reset those rows first.
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await supabase
      .from("prospect_studios")
      .update({ enrichment_status: "pending", enrichment_attempts: 0, enrichment_error: null })
      .in("id", body.ids.slice(0, MAX_BATCH));
  }

  const batchSize = Math.max(1, Math.min(Number(body.batchSize) || MAX_BATCH, MAX_BATCH));
  const { data: claimed, error: claimError } = await supabase.rpc("claim_prospect_enrichment", {
    batch_size: batchSize,
  });
  if (claimError) {
    console.error("[enrich-prospect-aesthetics] claim failed", claimError.message);
    return json({ error: "Could not claim leads" }, 500);
  }
  const prospects = (claimed ?? []) as Prospect[];
  if (prospects.length === 0) return json({ processed: 0, remaining: 0 });

  const { data: designers, error: designerError } = await supabase
    .from("designers")
    .select("id, name, slug, specialty, era, country")
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (designerError || !designers?.length) {
    console.error("[enrich-prospect-aesthetics] roster unavailable", designerError?.message);
    return json({ error: "Designer roster unavailable" }, 500);
  }
  const roster = designers as DesignerRow[];
  const bySlug = new Map(roster.map((d) => [d.slug, d]));

  let processed = 0;
  let failed = 0;
  let halted: string | null = null;

  for (const prospect of prospects) {
    if (halted) break;
    try {
      const summary = prospect.website_summary ?? (await summariseWebsite(prospect.website_url));
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: buildPrompt(prospect, summary, roster) }],
          response_format: { type: "json_object" },
        }),
      });

      // Circuit breaker: credits, policy and rate limits halt the whole batch.
      if (res.status === 402 || res.status === 403 || res.status === 429) {
        halted = `ai_${res.status}`;
        await supabase
          .from("prospect_studios")
          .update({ enrichment_status: "pending", enrichment_error: halted })
          .eq("id", prospect.id);
        break;
      }
      if (!res.ok) throw new Error(`AI ${res.status}`);

      const payload = await res.json();
      const parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}") as Analysis;

      const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
        .map((m) => {
          const designer = bySlug.get(String(m?.slug ?? "").trim());
          if (!designer) return null;
          return {
            slug: designer.slug,
            name: designer.name,
            specialty: designer.specialty,
            rationale: String(m?.rationale ?? "").slice(0, 400),
          };
        })
        .filter(Boolean)
        .slice(0, 2);

      if (!parsed.aesthetic_label || matches.length === 0) {
        throw new Error("Incomplete analysis");
      }

      await supabase
        .from("prospect_studios")
        .update({
          aesthetic_label: String(parsed.aesthetic_label).slice(0, 120),
          aesthetic_summary: String(parsed.aesthetic_summary ?? "").slice(0, 2000),
          matched_designers: matches,
          website_summary: summary,
          enrichment_status: "complete",
          enrichment_error: null,
          enriched_at: new Date().toISOString(),
        })
        .eq("id", prospect.id);
      processed++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[enrich-prospect-aesthetics] ${prospect.id} failed: ${message}`);
      // Attempts are incremented at claim time; three strikes parks the row.
      await supabase
        .from("prospect_studios")
        .update({
          enrichment_status: (prospect as Prospect & { enrichment_attempts?: number })
            .enrichment_attempts && false
            ? "failed"
            : "pending",
          enrichment_error: message.slice(0, 300),
        })
        .eq("id", prospect.id);
      await supabase
        .from("prospect_studios")
        .update({ enrichment_status: "failed" })
        .eq("id", prospect.id)
        .gte("enrichment_attempts", 3);
    }
  }

  const { count } = await supabase
    .from("prospect_studios")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "pending");

  return json({ processed, failed, halted, remaining: count ?? 0 });
});
