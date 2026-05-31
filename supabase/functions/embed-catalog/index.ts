// Backfills / refreshes embeddings for trade_products and designer_curator_picks.
// Admin-only. Idempotent: skips rows whose source text hash matches the stored one.
// Call with { limit?: number, force?: boolean, table?: 'trade_products'|'designer_curator_picks'|'both' }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";
import { embedBatch, catalogText, sourceHash } from "../_shared/aiEmbeddings.ts";
import { logAiUsage } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 500, 2000);
  const force = !!body.force;
  const table = body.table || "both";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const stats = { trade_products: 0, designer_curator_picks: 0, skipped: 0, failed: 0 };

  if (table === "both" || table === "designer_curator_picks") {
    stats.designer_curator_picks = await processTable(supabase, apiKey, "designer_curator_picks", limit, force, stats);
  }
  if (table === "both" || table === "trade_products") {
    stats.trade_products = await processTable(supabase, apiKey, "trade_products", limit, force, stats);
  }

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processTable(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  table: "trade_products" | "designer_curator_picks",
  limit: number,
  force: boolean,
  stats: { skipped: number; failed: number },
): Promise<number> {
  // Pull rows that need embedding. Designers are resolved separately to avoid embedding noise.
  const isTrade = table === "trade_products";
  const cols = isTrade
    ? "id, product_name, brand_name, category, subcategory, materials, description, embedding_source_hash"
    : "id, title, designer_id, category, subcategory, materials, description, embedding_source_hash";
  let query = supabase.from(table).select(cols).limit(limit);
  if (isTrade) query = query.eq("is_active", true);
  if (!force) query = query.is("embedding", null);
  const { data: rows, error } = await query;
  if (error) {
    console.error(`${table} fetch failed:`, error);
    return 0;
  }
  if (!rows?.length) return 0;

  // Resolve designer names for curator picks in one shot.
  const designerMap = new Map<string, string>();
  if (!isTrade) {
    const ids = Array.from(new Set((rows as any[]).map((r) => r.designer_id).filter(Boolean)));
    if (ids.length) {
      const { data: ds } = await supabase.from("designers").select("id, name, display_name").in("id", ids);
      (ds || []).forEach((d: any) => designerMap.set(d.id, d.display_name || d.name));
    }
  }

  // Build source text + hash; skip rows whose hash already matches.
  const work: Array<{ id: string; text: string; hash: string }> = [];
  for (const r of rows as any[]) {
    const text = catalogText({
      title: isTrade ? r.product_name : r.title,
      designer: isTrade ? r.brand_name : designerMap.get(r.designer_id),
      category: r.category,
      subcategory: r.subcategory,
      materials: r.materials,
      description: r.description,
    });
    if (!text.trim()) { stats.skipped++; continue; }
    const hash = await sourceHash(text);
    if (!force && r.embedding_source_hash === hash) { stats.skipped++; continue; }
    work.push({ id: r.id, text, hash });
  }

  let written = 0;
  for (let i = 0; i < work.length; i += BATCH) {
    const chunk = work.slice(i, i + BATCH);
    const vectors = await embedBatch(apiKey, chunk.map((c) => c.text));
    const totalChars = chunk.reduce((s, c) => s + c.text.length, 0);
    logAiUsage({
      feature: "embed-catalog",
      model: "openai/text-embedding-3-small",
      usage: { prompt_tokens: Math.ceil(totalChars / 4), completion_tokens: 0, total_tokens: Math.ceil(totalChars / 4) },
    }).catch(() => {});

    await Promise.all(chunk.map(async (row, idx) => {
      const vec = vectors[idx];
      if (!vec) { stats.failed++; return; }
      const { error: upErr } = await supabase
        .from(table)
        .update({
          embedding: vec as any,
          embedding_source_hash: row.hash,
          embedded_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) { stats.failed++; console.error(`${table} update failed for ${row.id}:`, upErr.message); }
      else written++;
    }));
  }
  return written;
}
