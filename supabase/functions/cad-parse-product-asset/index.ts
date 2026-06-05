// Parse a CAD/3D file already attached to a trade_product (trade_product_cad_assets).
// Caches the bbox/metrics in product_cad_asset_geometry.
// Body: { cad_asset_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/auth.ts";
import { parseCadFile } from "../_shared/cadParse.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req, "cad-parse-product-asset");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { cad_asset_id?: string };
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const assetId = payload.cad_asset_id;
  if (!assetId) {
    return new Response(JSON.stringify({ error: "cad_asset_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Caller must be a trade user (RLS on trade_product_cad_assets enforces this)
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth.authHeader } } },
  );
  const { data: asset, error: aErr } = await userClient
    .from("trade_product_cad_assets")
    .select("id, product_id, variant_label, file_url, file_format")
    .eq("id", assetId)
    .maybeSingle();
  if (aErr || !asset) {
    return new Response(JSON.stringify({ error: "Asset not found or access denied" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Serve from cache if already parsed
  const { data: cached } = await svc
    .from("product_cad_asset_geometry")
    .select("id, status, bbox_mm, units, metrics, error")
    .eq("cad_asset_id", assetId)
    .maybeSingle();
  if (cached && cached.status === "ready") {
    return new Response(JSON.stringify({ ok: true, cached: true, geometry: cached }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await svc.from("product_cad_asset_geometry").upsert({
    cad_asset_id: assetId,
    product_id: asset.product_id,
    variant_label: asset.variant_label,
    file_format: asset.file_format,
    status: "parsing",
    error: null,
  }, { onConflict: "cad_asset_id" });

  // Download the file from its absolute URL
  let bytes: ArrayBuffer;
  try {
    const resp = await fetch(asset.file_url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    bytes = await resp.arrayBuffer();
  } catch (e) {
    const msg = `Download failed: ${e instanceof Error ? e.message : String(e)}`;
    await svc.from("product_cad_asset_geometry").update({
      status: "failed", error: msg, parsed_at: new Date().toISOString(),
    }).eq("cad_asset_id", assetId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await parseCadFile(bytes, asset.file_format);
  if (!result.ok) {
    await svc.from("product_cad_asset_geometry").update({
      status: result.unsupported ? "unsupported" : "failed",
      error: result.error,
      parsed_at: new Date().toISOString(),
    }).eq("cad_asset_id", assetId);
    return new Response(JSON.stringify({ ok: false, unsupported: !!result.unsupported, error: result.error }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await svc.from("product_cad_asset_geometry").update({
    status: "ready",
    bbox_mm: result.geometry.bbox_mm,
    units: result.geometry.units,
    metrics: result.geometry.metrics,
    error: null,
    parsed_at: new Date().toISOString(),
  }).eq("cad_asset_id", assetId);

  return new Response(JSON.stringify({ ok: true, geometry: result.geometry }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
