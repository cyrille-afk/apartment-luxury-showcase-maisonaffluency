// Admin-only batch embedder for concierge_roster_embeddings.
//
// Reads the static ROSTER (built from published designers) and upserts a
// 1536-dim OpenAI text-embedding-3-small vector per entry into
// public.concierge_roster_embeddings. Call once after each roster refresh:
//
//   curl -X POST https://<project>.functions.supabase.co/concierge-roster-reindex \
//        -H "Authorization: Bearer <user-jwt-with-admin-role>"
//
// Response: { indexed: number, skipped: number, model: "..." }
//
// Design notes:
// - Auth: requires the caller to have the `admin` app_role. We reuse the
//   existing has_role() security-definer so no new privilege surface is added.
// - Rate: batches to ~50 inputs/request (well under the 300k-token OpenAI
//   embeddings cap for tiny name+specialty strings).
// - Idempotent: uses ON CONFLICT(name) so a repeat run just refreshes vectors.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ROSTER } from "./_roster.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;
const BATCH = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`embed ${r.status}: ${body.slice(0, 400)}`);
  }
  const json = await r.json();
  // Preserve original order via data[].index.
  const out: number[][] = new Array(inputs.length);
  for (const row of json.data) out[row.index] = row.embedding;
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin auth. Accepts a service-role Bearer (server-to-server / one-off
  // maintenance triggers) or a user JWT whose sub has the admin role.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (token !== SERVICE_ROLE_KEY) {
    const { data: claimsData, error: claimsErr } = await sb.auth.getClaims(token);
    const sub = (claimsData?.claims as { sub?: string } | null | undefined)?.sub;
    if (claimsErr || !sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
      _user_id: sub,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const entries = ROSTER.map((r) => ({
    name: r.name,
    specialty: r.specialty || "",
    // Embed a compact "Name — specialty" string so semantic similarity
    // picks up both surface name recognition and topical intent.
    text: r.specialty ? `${r.name} — ${r.specialty}` : r.name,
  }));

  let indexed = 0;
  let skipped = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    let vectors: number[][];
    try {
      vectors = await embedBatch(slice.map((s) => s.text));
    } catch (e) {
      console.error(`[roster-reindex] batch ${i} failed`, e);
      skipped += slice.length;
      continue;
    }

    const rows = slice.map((s, j) => ({
      name: s.name,
      specialty: s.specialty || null,
      // pgrest accepts a stringified array; the DB casts to vector(1536).
      embedding: JSON.stringify(vectors[j]),
      model_version: EMBED_MODEL,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await sb
      .from("concierge_roster_embeddings")
      .upsert(rows, { onConflict: "name" });
    if (error) {
      console.error(`[roster-reindex] upsert batch ${i} failed`, error);
      skipped += slice.length;
      continue;
    }
    indexed += slice.length;
  }

  return new Response(
    JSON.stringify({ indexed, skipped, model: EMBED_MODEL, total: entries.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
