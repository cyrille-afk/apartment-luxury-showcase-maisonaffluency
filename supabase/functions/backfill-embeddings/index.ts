// Canonical RAG migration: backfills product_embeddings for catalog picks
// that have no embedding row yet. Admin-only. Batches of 10 per invocation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const BATCH_SIZE = 10;

async function gatewayPost(path: string, apiKey: string, body: unknown) {
  const res = await fetch(`${AI_GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

type Pick = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  materials_description: string | null;
  dimensions: string | null;
  designer_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const auth = await requireAdmin(req, "backfill-embeddings");
    if (!auth.ok) return json(auth.body, auth.status);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = (body as { action?: string }).action ?? "status";

    // --- Counters (shared by both actions) -------------------------------
    const countMissing = async () => {
      const { count: total, error: e1 } = await svc
        .from("designer_curator_picks")
        .select("id", { count: "exact", head: true });
      if (e1) throw e1;
      const { count: embedded, error: e2 } = await svc
        .from("product_embeddings")
        .select("product_id", { count: "exact", head: true });
      if (e2) throw e2;
      return { total: total ?? 0, embedded: embedded ?? 0, missing: Math.max((total ?? 0) - (embedded ?? 0), 0) };
    };

    if (action === "status") {
      return json({ success: true, ...(await countMissing()) });
    }

    if (action !== "backfill") return json({ error: "Unknown action" }, 400);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("Missing LOVABLE_API_KEY");

    // --- Find picks with no matching product_embeddings row ---------------
    const { data: existing, error: exErr } = await svc
      .from("product_embeddings")
      .select("product_id");
    if (exErr) throw exErr;
    const done = new Set((existing ?? []).map((r) => r.product_id as string));

    const { data: picks, error: pErr } = await svc
      .from("designer_curator_picks")
      .select("id, title, subtitle, description, materials_description, dimensions, designer_id")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (pErr) throw pErr;

    const pending = ((picks ?? []) as Pick[]).filter((p) => !done.has(p.id)).slice(0, BATCH_SIZE);

    if (!pending.length) {
      return json({ success: true, processed: 0, results: [], ...(await countMissing()) });
    }

    // Resolve designer names in one query
    const designerIds = [...new Set(pending.map((p) => p.designer_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    if (designerIds.length) {
      const { data: designers } = await svc
        .from("designers")
        .select("id, name, display_name")
        .in("id", designerIds);
      (designers ?? []).forEach((d) => {
        nameById.set(d.id as string, (d.display_name as string) || (d.name as string) || "Unattributed");
      });
    }

    const results: { id: string; title: string; designer: string; ok: boolean; error?: string }[] = [];

    for (const p of pending) {
      const designerName = (p.designer_id && nameById.get(p.designer_id)) || "Unattributed";
      const verbatimTitle = p.title?.trim() || "Untitled";
      try {
        const aiData = await gatewayPost("/chat/completions", lovableApiKey, {
          model: "openai/gpt-6-astra",
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert data parsing agent for high-end furniture. Return a JSON object with:
  "clean_chunk": A dense, scholarly paragraph capturing form, silhouette, materiality and style heritage. No marketing fluff.
  "taxonomy": An array of lowercase design tags.
  "dimensions": An object with keys width_mm, depth_mm, height_mm (numbers or null).`,
            },
            {
              role: "user",
              content: `Title: ${verbatimTitle}. Subtitle: ${p.subtitle ?? ""}. Designer: ${designerName}. Description: ${(p.description ?? "").slice(0, 2000)}. Materials: ${(p.materials_description ?? "").slice(0, 800)}. Dimensions: ${p.dimensions ?? ""}`,
            },
          ],
        });
        const structured = JSON.parse(aiData.choices[0].message.content);

        const embeddingData = await gatewayPost("/embeddings", lovableApiKey, {
          model: "openai/text-embedding-3-small",
          input: structured.clean_chunk,
        });
        const embedding = embeddingData.data[0].embedding;

        const { error: upErr } = await svc.from("product_embeddings").upsert(
          {
            product_id: p.id,
            designer_name: designerName,
            verbatim_title: verbatimTitle,
            dimensions_json: structured.dimensions ?? null,
            design_taxonomy: structured.taxonomy ?? [],
            content_chunk: structured.clean_chunk,
            embedding: JSON.stringify(embedding),
          },
          { onConflict: "product_id" },
        );
        if (upErr) throw upErr;

        results.push({ id: p.id, title: verbatimTitle, designer: designerName, ok: true });
      } catch (err) {
        results.push({
          id: p.id,
          title: verbatimTitle,
          designer: designerName,
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    const counts = await countMissing();
    return json({
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
      ...counts,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
