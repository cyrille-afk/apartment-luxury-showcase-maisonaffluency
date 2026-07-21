// Edge-cached catalog manifest.
//
// Returns the trimmed lightweight payload the homepage Gallery / DesignersDirectory
// grids need to render cards — no gallery_images / variant_image_map / size_variants /
// materials_description / description / pdf_urls. Heavy per-item detail is fetched
// lazily via useCuratorPickDetail when a card is opened.
//
// Cached by the browser AND any intermediate CDN via a plain GET + Cache-Control:
//   public, s-maxage=300, stale-while-revalidate=86400
//
// -> 5 min fresh at the edge, 24 h stale-while-revalidate window. This is the
// single high-traffic listing that was showing up as the top slow query
// (SELECT on designer_curator_picks_public, 1200+ calls, 155 ms mean).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const PICK_COLUMNS = [
  "id",
  "title",
  "subtitle",
  "image_url",
  "hover_image_url",
  "materials",
  "dimensions",
  "lead_time",
  "origin",
  "category",
  "subcategory",
  "pdf_url",
  "designer_id",
  "variant_placeholder",
  "base_axis_label",
  "top_axis_label",
  "tags",
  "sort_order",
  "created_at",
].join(",");

const CACHE_HEADERS = {
  // Browsers + Cloudflare / Netlify / Lovable CDN honor s-maxage + SWR.
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
  // The response is identical for every anon caller, so no Vary needed on auth.
  Vary: "Accept-Encoding",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Anon key + RLS: the public policy on designer_curator_picks_public
    // already scopes to visible / published / non-trade-only rows.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const [picksRes, designersRes] = await Promise.all([
      supabase
        .from("designer_curator_picks_public")
        .select(PICK_COLUMNS)
        .not("image_url", "is", null),
      supabase
        .from("designers")
        .select("id, name, slug, display_name, source, founder, era, country, is_published, trade_only")
        .eq("is_published", true)
        .eq("trade_only", false),
    ]);

    if (picksRes.error) throw picksRes.error;
    if (designersRes.error) throw designersRes.error;

    const body = JSON.stringify({
      generated_at: new Date().toISOString(),
      picks: picksRes.data ?? [],
      designers: designersRes.data ?? [],
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...CACHE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("[catalog-manifest] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Never cache error responses.
          "Cache-Control": "no-store",
        },
      },
    );
  }
});
