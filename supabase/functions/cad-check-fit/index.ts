// Run a deterministic bbox/clearance fit check between a parsed room
// (from a cad_documents floor plan) and a trade product.
// Body: { cad_document_id, room_label?, product_id, variant_label?, clearance_mm? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/auth.ts";
import { checkBboxFit, type Bbox } from "../_shared/cadParse.ts";

type ProductDims = { width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null };

function bboxFromDims(d: ProductDims): Bbox | null {
  if (!d.width_mm || !d.depth_mm) return null;
  return {
    w: d.width_mm, d: d.depth_mm, h: d.height_mm || 0,
    min: [0, 0, 0],
    max: [d.width_mm, d.depth_mm, d.height_mm || 0],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req, "cad-check-fit");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { cad_document_id, room_label, product_id, variant_label, clearance_mm } = body || {};
  if (!cad_document_id || !product_id) {
    return new Response(JSON.stringify({ error: "cad_document_id and product_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const clearance = typeof clearance_mm === "number" ? clearance_mm : 600;

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth.authHeader } } },
  );
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: doc, error: dErr } = await userClient
    .from("cad_documents")
    .select("id, parsed_geometry, status")
    .eq("id", cad_document_id).maybeSingle();
  if (dErr || !doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (doc.status !== "ready" || !doc.parsed_geometry) {
    return new Response(JSON.stringify({ error: "Floor plan not parsed yet" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rooms: any[] = (doc.parsed_geometry as any).rooms || [];
  if (!rooms.length) {
    return new Response(JSON.stringify({ error: "No rooms detected in floor plan" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const room = (room_label
    ? rooms.find((r) => (r.label || "").toLowerCase() === String(room_label).toLowerCase())
    : rooms[0]) || rooms[0];

  // Prefer parsed product geometry from product_cad_asset_geometry; fall back to declared dims
  let productBbox: Bbox | null = null;
  const { data: geomRows } = await svc
    .from("product_cad_asset_geometry")
    .select("bbox_mm, variant_label, status")
    .eq("product_id", product_id)
    .eq("status", "ready");
  if (geomRows && geomRows.length) {
    const match = variant_label
      ? geomRows.find((g: any) => (g.variant_label || "") === variant_label)
      : null;
    const pick = match || geomRows[0];
    productBbox = pick.bbox_mm as Bbox;
  }
  if (!productBbox) {
    const { data: prod } = await svc
      .from("trade_products")
      .select("width_mm, depth_mm, height_mm")
      .eq("id", product_id).maybeSingle();
    if (prod) productBbox = bboxFromDims(prod as ProductDims);
  }

  const { verdict, reasons } = checkBboxFit(productBbox, room.bbox_mm as Bbox, clearance);

  // Persist the report (best-effort; ignore RLS failures from anon edge calls)
  try {
    await userClient.from("cad_fit_reports").insert({
      cad_document_id,
      room_label: room.label,
      product_id,
      variant_label: variant_label || null,
      verdict,
      reasons,
      product_bbox_mm: productBbox,
      room_bbox_mm: room.bbox_mm,
      created_by: auth.userId,
    });
  } catch { /* non-blocking */ }

  return new Response(JSON.stringify({
    ok: true,
    verdict,
    reasons,
    room: { label: room.label, bbox_mm: room.bbox_mm, area_m2: room.area_m2 },
    product: { id: product_id, bbox_mm: productBbox, source: productBbox ? "cad_or_dims" : "missing" },
    clearance_mm: clearance,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
