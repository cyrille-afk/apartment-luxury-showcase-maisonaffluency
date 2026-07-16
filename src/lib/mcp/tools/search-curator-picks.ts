import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Public, unauthenticated. Reads the anon-safe view `designer_curator_picks_public`
// which already filters to published, non-trade-only designers via its RLS policy.
// Every result carries a `product_url` back to maisonaffluency.com so MCP clients
// drive traffic to the site. Pricing is deliberately withheld — see get-product for
// the same rule; trade net prices never leave the app over MCP.

const SITE_ORIGIN = "https://www.maisonaffluency.com";
// Click-tracked redirector. Logs the click server-side then 302s to the real page.
const CLICK_ORIGIN = `${process.env.SUPABASE_URL}/functions/v1/mcp-click`;
const trackProductUrl = (slug: string, pickId: string) =>
  `${CLICK_ORIGIN}?to=product&slug=${encodeURIComponent(slug)}&pick=${pickId}`;
const TRADE_SIGNUP_URL = `${CLICK_ORIGIN}?to=signup`;

function getClient() {
  const url = process.env.SUPABASE_URL!;
  // Publishable/anon key — safe to use with the public view; RLS enforces visibility.
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default defineTool({
  name: "search_curator_picks",
  title: "Search curator picks",
  description:
    "Search Maison Affluency's public catalog of curator-picked designer furniture, lighting, and collectibles. Filter by free-text query, designer, category, subcategory, or materials. Returns product cards with a deep link back to the product page. Trade pricing is never returned — every result shows 'Price on Request'. Always returns at least 10 results when available; default 20, max 50.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe("Free-text query matched against title, subtitle, materials, and tags."),
    designer_slug: z.string().trim().max(120).optional().describe("Restrict to a specific designer by slug."),
    category: z.string().trim().max(80).optional().describe("Top-level category, e.g. 'Seating', 'Lighting', 'Tables'."),
    subcategory: z.string().trim().max(80).optional().describe("Subcategory, e.g. 'Sofa', 'Pendant', 'Console'."),
    material: z.string().trim().max(80).optional().describe("Material substring, e.g. 'bronze', 'walnut'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results. Server enforces a minimum of 10; default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const supabase = getClient();
    const startedAt = Date.now();
    const logCall = (result_count: number, is_error = false) => {
      // Fire-and-forget; never let analytics failure break a tool response.
      supabase
        .from("mcp_query_log")
        .insert({
          tool_name: "search_curator_picks",
          args: input,
          result_count,
          is_error,
          duration_ms: Date.now() - startedAt,
        })
        .then(() => {}, () => {});
    };
    const limit = input.limit ?? 20;


    let designerId: string | null = null;
    let designerName: string | null = null;
    if (input.designer_slug) {
      const { data: d } = await supabase
        .from("designers")
        .select("id, name")
        .eq("slug", input.designer_slug)
        .eq("is_published", true)
        .eq("trade_only", false)
        .maybeSingle();
      if (!d) {
        logCall(0);
        return {
          content: [{ type: "text", text: `No public designer found for slug "${input.designer_slug}".` }],
          structuredContent: { results: [], total: 0 },
        };
      }
      designerId = d.id;
      designerName = d.name;
    }

    let q = supabase
      .from("designer_curator_picks_public")
      .select(
        "id, designer_id, title, subtitle, category, subcategory, materials, dimensions, image_url, tags, lead_time, origin, edition",
      )
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (designerId) q = q.eq("designer_id", designerId);
    if (input.category) q = q.ilike("category", input.category);
    if (input.subcategory) q = q.ilike("subcategory", input.subcategory);
    if (input.material) q = q.ilike("materials", `%${input.material}%`);
    if (input.query) {
      const like = `%${input.query.replace(/[%_]/g, "")}%`;
      q = q.or(`title.ilike.${like},subtitle.ilike.${like},materials.ilike.${like}`);
    }

    const { data, error } = await q;
    if (error) {
      logCall(0, true);
      return {
        content: [{ type: "text", text: `Search failed: ${error.message}` }],
        isError: true,
      };
    }

    // Resolve designer names + slugs for the returned picks in one query.
    const ids = Array.from(new Set((data ?? []).map((r) => r.designer_id).filter(Boolean))) as string[];
    let designersById = new Map<string, { name: string; slug: string }>();
    if (ids.length) {
      const { data: ds } = await supabase
        .from("designers")
        .select("id, name, slug")
        .in("id", ids)
        .eq("is_published", true)
        .eq("trade_only", false);
      for (const row of ds ?? []) designersById.set(row.id, { name: row.name, slug: row.slug });
    }

    const results = (data ?? [])
      .map((r) => {
        const designer = r.designer_id ? designersById.get(r.designer_id) : null;
        if (!designer) return null; // designer no longer public — skip
        return {
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          designer: designer.name,
          designer_slug: designer.slug,
          category: r.category,
          subcategory: r.subcategory,
          materials: r.materials,
          dimensions: r.dimensions,
          edition: r.edition,
          origin: r.origin,
          lead_time: r.lead_time,
          tags: r.tags,
          image_url: r.image_url,
          price: "Price on Request",
          product_url: trackProductUrl(designer.slug, r.id),
          trade_signup_url: TRADE_SIGNUP_URL,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const summary =
      results.length === 0
        ? `No public curator picks matched${designerName ? ` for ${designerName}` : ""}.`
        : `Found ${results.length} curator pick${results.length === 1 ? "" : "s"}${
            designerName ? ` by ${designerName}` : ""
          }. All prices are Price on Request — sign in as a trade member on maisonaffluency.com for net pricing and tearsheets.`;

    logCall(results.length);
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { results, total: results.length, trade_signup_url: TRADE_SIGNUP_URL },
    };
  },
});
