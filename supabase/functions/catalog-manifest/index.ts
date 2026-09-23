// Edge-cached catalog manifest.
//
// Returns the trimmed lightweight payload the homepage Gallery / DesignersDirectory
// grids need to render cards — no gallery_images / variant_image_map / size_variants /
// materials_description / description / pdf_urls. Heavy per-item detail is fetched
// lazily via useCuratorPickDetail when a card is opened.
//
// Cached by the browser AND any intermediate CDN via a plain GET + Cache-Control:
//   public, s-maxage=3600, stale-while-revalidate=86400
//
// -> 1 h fresh at the edge, 24 h stale-while-revalidate window. This is the
// single high-traffic listing that was showing up as the top slow query
// (SELECT on designer_curator_picks_public, 1200+ calls, 155 ms mean).
//
// Signed-in trade users bypass the shared cache entirely (no-store, private)
// and are served with their own JWT so RLS applies their pricing visibility.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthenticatedRequest, publicCacheHeaders } from "../_shared/publicCache.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const PICK_COLUMNS = [
  "id",
  "slug",
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
  "pdf_urls",
  "pdf_filename",
  "photo_credit",
  "edition",
  "designer_id",
  "variant_placeholder",
  "base_axis_label",
  "top_axis_label",
  "tags",
  "sort_order",
  "created_at",
].join(",");


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
    // A signed-in trade user is served with their own JWT (and never cached).
    const authHeader = req.headers.get("Authorization");
    const authenticated = isAuthenticatedRequest(req);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      ...(authenticated && authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : {}),
    });

    // Bounded, retried reads. The listing occasionally hit a Postgres
    // statement timeout (SQLSTATE 57014) under load, which surfaced as a 500
    // and an empty homepage grid. One short retry absorbs that transient case;
    // the explicit range keeps the payload bounded.
    const withRetry = async <T>(run: () => Promise<{ data: T | null; error: unknown }>) => {
      let last: { data: T | null; error: unknown } = await run();
      if (last.error) {
        await new Promise((r) => setTimeout(r, 400));
        last = await run();
      }
      return last;
    };

    const [picksRes, designersRes] = await Promise.all([
      withRetry(() =>
        supabase
          .from("designer_curator_picks_public")
          .select(PICK_COLUMNS)
          .not("image_url", "is", null)
          .order("sort_order", { ascending: true })
          .range(0, 4999)
      ),
      withRetry(() =>
        supabase
          .from("designers")
          .select("id, name, slug, display_name, source, founder, era, country, is_published, trade_only")
          .eq("is_published", true)
          .range(0, 4999)
      ),
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
        ...publicCacheHeaders(req),
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
