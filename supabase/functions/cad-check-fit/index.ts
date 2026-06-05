// Run a deterministic bbox/clearance fit check between a parsed room
// (from a cad_documents floor plan) and a trade product.
// Body: { cad_document_id, room_label?, product_id, cad_asset_id?, variant_label?, clearance_mm? }
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

// Best-effort parser for free-text dimension strings:
// "H85 × W140 × D40 cm" / "W102 x D66 cm" / "DIA22 x H85 cm" / "570 × 110 × 80 mm"
function parseDimensionsText(text: string | null | undefined): ProductDims | null {
  if (!text) return null;
  const clean = text.replace(/[×✕]/g, "x");
  const unit = /\bmm\b/i.test(clean) ? "mm" : /\bcm\b/i.test(clean) ? "cm" : /\bin\b|"/i.test(clean) ? "in" : "cm";
  const toMm = (n: number) => unit === "mm" ? n : unit === "cm" ? n * 10 : n * 25.4;
  const grab = (re: RegExp) => {
    const m = clean.match(re);
    return m ? toMm(parseFloat(m[1])) : null;
  };
  const W = grab(/(?:^|[^A-Za-z])W\s*([\d.]+)/i);
  const D = grab(/(?:^|[^A-Za-z])D\s*([\d.]+)/i);
  const H = grab(/(?:^|[^A-Za-z])H\s*([\d.]+)/i);
  const DIA = grab(/DIA\s*([\d.]+)/i);
  if (W || D || H || DIA) {
    return {
      width_mm: W ?? DIA ?? null,
      depth_mm: D ?? DIA ?? null,
      height_mm: H ?? null,
    };
  }
  const nums = clean.match(/([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*([\d.]+))?/i);
  if (nums) {
    const a = toMm(parseFloat(nums[1]));
    const b = toMm(parseFloat(nums[2]));
    const c = nums[3] ? toMm(parseFloat(nums[3])) : null;
    return { width_mm: a, depth_mm: b, height_mm: c };
  }
  return null;
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
  const { cad_document_id, room_label, product_id, cad_asset_id, variant_label, clearance_mm } = body || {};
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

  // Prefer the selected product-attached CAD/3D asset geometry; fall back to any ready geometry, then declared dims.
  let productBbox: Bbox | null = null;
  const { data: geomRows } = await svc
    .from("product_cad_asset_geometry")
    .select("cad_asset_id, bbox_mm, variant_label, status")
    .eq("product_id", product_id)
    .eq("status", "ready");
  if (geomRows && geomRows.length) {
    const assetMatch = cad_asset_id
      ? geomRows.find((g: any) => g.cad_asset_id === cad_asset_id)
      : null;
    const variantMatch = variant_label
      ? geomRows.find((g: any) => (g.variant_label || "") === variant_label)
      : null;
    const pick = assetMatch || variantMatch || geomRows[0];
    productBbox = pick.bbox_mm as Bbox;
  }
  if (!productBbox) {
    const { data: prod } = await svc
      .from("trade_products")
      .select("dimensions")
      .eq("id", product_id).maybeSingle();
    const parsed = parseDimensionsText((prod as any)?.dimensions);
    if (parsed) productBbox = bboxFromDims(parsed);
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
    product: { id: product_id, cad_asset_id: cad_asset_id || null, bbox_mm: productBbox, source: productBbox ? "cad_or_dims" : "missing" },
    clearance_mm: clearance,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
