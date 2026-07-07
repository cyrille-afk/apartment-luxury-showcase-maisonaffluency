// Test-only probe for the concierge-public-stream grounding pipeline.
//
// Exposes the deterministic Tier A + semantic Tier B grounding output as
// JSON so end-to-end tests can assert that when Tier A (lexical roster
// mentions) yields nothing, Tier B (embedding + match_roster_public RPC)
// still surfaces relevant roster entries.
//
// Auth: any authenticated user JWT. The output contains only public roster
// names/specialties already used across the site, so no additional gating
// is required. The RPC (match_roster_public) is service-role-only, so this
// function is the only supported surface for tests to reach it.
//
// Request:  POST { query: string }
// Response: {
//   query: string,
//   tier_a_specialties: string,          // "" when no roster name mentioned
//   tier_a_empty: boolean,               // convenience flag
//   semantic_hits: Array<{ name, specialty, similarity }>,
//   grounding_block: string,             // exactly what the stream would inject
//   has_details_section: boolean,        // grounding_block contains a details block
//   embed_ok: boolean,                   // Lovable AI embeddings call succeeded
//   rpc_ok: boolean,                     // match_roster_public returned rows
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildGroundingBlock, buildQuerySpecialties } from "./_grounding.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;
const TOP_K = 6;
const SIM_FLOOR = 0.25;
const SIM_STRICT_FLOOR = 0.45;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sbAnon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const sbSvc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth — any valid user JWT.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: claims, error: claimsErr } = await sbAnon.auth.getClaims(token);
  const sub = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (claimsErr || !sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { query?: unknown };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const query = typeof body.query === "string" ? body.query.slice(0, 2000).trim() : "";
  if (!query) {
    return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tier A — pure string match on roster names.
  const tierA = buildQuerySpecialties(query);

  // Tier B — embed the query and query match_roster_public.
  let embed_ok = false;
  let rpc_ok = false;
  let semanticHits: Array<{ name: string; specialty: string; similarity: number }> = [];
  let retrieval_status: "ok" | "low_confidence" | "unavailable" = "unavailable";
  let top_similarity = 0;
  try {
    const r = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: query, dimensions: EMBED_DIMS }),
    });
    if (r.ok) {
      const j = await r.json();
      const vec = j?.data?.[0]?.embedding;
      if (Array.isArray(vec) && vec.length === EMBED_DIMS) {
        embed_ok = true;
        const { data: matches, error: matchErr } = await sbSvc.rpc("match_roster_public", {
          query_embedding: vec as unknown as string,
          match_count: TOP_K,
        });
        if (!matchErr && Array.isArray(matches)) {
          rpc_ok = true;
          const scored = matches.map((m: { name: string; specialty: string | null; similarity?: number }) => ({
            name: m.name,
            specialty: m.specialty ?? "",
            similarity: Number(m.similarity ?? 0),
          }));
          top_similarity = scored.reduce((a, b) => (b.similarity > a ? b.similarity : a), 0);
          semanticHits = scored.filter((m) => m.similarity > SIM_FLOOR);
          retrieval_status = top_similarity >= SIM_STRICT_FLOOR ? "ok" : "low_confidence";
        }
      }
    }
  } catch (e) {
    console.warn("[concierge-grounding-probe] retrieval failed", e);
  }

  const grounding_block = buildGroundingBlock(
    query,
    semanticHits.map((h) => ({ name: h.name, specialty: h.specialty })),
    { retrievalStatus: retrieval_status },
  );

  return new Response(JSON.stringify({
    query,
    tier_a_specialties: tierA,
    tier_a_empty: tierA.length === 0,
    semantic_hits: semanticHits,
    top_similarity,
    retrieval_status,
    grounding_block,
    has_details_section: grounding_block.includes("Most relevant roster members") || grounding_block.includes("Roster members that MAY relate"),
    graceful_refusal: grounding_block.includes("No confident roster match") || grounding_block.includes("No retrieval context"),
    embed_ok,
    rpc_ok,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
});
