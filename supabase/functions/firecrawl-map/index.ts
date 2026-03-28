import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { url, search, limit = 200, filter_path, group_by_brand } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Firecrawl Map API
    const mapPayload: Record<string, any> = { url, limit };
    if (search) mapPayload.search = search;

    const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify(mapPayload),
    });

    const mapData = await mapRes.json();

    if (!mapData.success) {
      return new Response(JSON.stringify({ error: "Map failed", detail: mapData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let links: string[] = mapData.links || [];

    // Filter to product pages only (common patterns)
    const productLinks = links.filter((l: string) => {
      const path = new URL(l).pathname;
      // Common product URL patterns
      if (path.includes("/product/") || path.includes("/products/")) return true;
      if (path.includes("/item/") || path.includes("/items/")) return true;
      if (path.includes("/shop/") && path.split("/").length > 3) return true;
      return false;
    });

    // Apply optional path filter
    let filtered = productLinks;
    if (filter_path) {
      filtered = productLinks.filter((l: string) =>
        l.toLowerCase().includes(filter_path.toLowerCase())
      );
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase().replace(/\s+/g, "");
      filtered = filtered.filter((l: string) => {
        const slug = new URL(l).pathname.toLowerCase().replace(/[-_/]/g, "");
        return slug.includes(searchLower);
      });
    }

    // Group by brand/designer slug if requested
    if (group_by_brand) {
      const groups: Record<string, { slug: string; label: string; urls: string[] }> = {};
      for (const link of productLinks) {
        try {
          const path = new URL(link).pathname;
          // Extract brand slug from common URL patterns:
          // /product/brand-name-product-title/ → try to match brand prefix
          // /products-category/designer/brand-name/ → brand-name
          const segments = path.split("/").filter(Boolean);
          
          let brandSlug = "unknown";
          
          // Pattern: /product/brandslug-productname/
          if (segments[0] === "product" && segments[1]) {
            // Try splitting on common separators — take first 1-3 words as brand
            const parts = segments[1].split("-");
            // Heuristic: look for repeating prefixes across all URLs
            brandSlug = segments[1]; // full slug as fallback
          }
          
          if (!groups[brandSlug]) {
            // Create label from slug
            const label = brandSlug
              .split("-")
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            groups[brandSlug] = { slug: brandSlug, label, urls: [] };
          }
          groups[brandSlug].urls.push(link);
        } catch {
          // skip malformed URLs
        }
      }
      
      // Now try to find common prefixes to group better
      const allSlugs = Object.keys(groups);
      if (allSlugs.length > 10) {
        // Re-group by extracting brand prefix from product slugs
        const regrouped: Record<string, { slug: string; label: string; urls: string[] }> = {};
        
        for (const link of productLinks) {
          try {
            const path = new URL(link).pathname;
            const segments = path.split("/").filter(Boolean);
            if (segments[0] === "product" && segments[1]) {
              const parts = segments[1].split("-");
              // Try progressively shorter prefixes to find groupings
              // Most e-commerce sites use: brand-slug-product-name
              // We'll try 2-word prefix first, then 3-word
              let bestPrefix = parts.slice(0, 2).join("-");
              
              if (!regrouped[bestPrefix]) {
                const label = bestPrefix
                  .split("-")
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ");
                regrouped[bestPrefix] = { slug: bestPrefix, label, urls: [] };
              }
              regrouped[bestPrefix].urls.push(link);
            }
          } catch {}
        }
        
        // If regrouping gives 2-50 groups, use it; otherwise fall back to full slugs
        const regroupedArr = Object.values(regrouped).filter(g => g.urls.length > 0);
        if (regroupedArr.length >= 2 && regroupedArr.length <= 200) {
          return new Response(
            JSON.stringify({
              success: true,
              total_links: links.length,
              product_links: productLinks.length,
              brands: regroupedArr.sort((a, b) => a.label.localeCompare(b.label)),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const brandsArr = Object.values(groups).filter(g => g.urls.length > 0);
      return new Response(
        JSON.stringify({
          success: true,
          total_links: links.length,
          product_links: productLinks.length,
          brands: brandsArr.sort((a, b) => a.label.localeCompare(b.label)),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_links: links.length,
        product_links: productLinks.length,
        filtered_links: filtered.length,
        urls: filtered,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("firecrawl-map error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
