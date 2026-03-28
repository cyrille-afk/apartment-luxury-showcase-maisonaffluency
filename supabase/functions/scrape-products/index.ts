import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScrapeRequest {
  urls: string[];
  brand_name: string;
  category?: string;
  extract_prompt?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userId = claimsData.claims.sub as string;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some(
      (r: { role: string }) =>
        r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ScrapeRequest = await req.json();
    const { urls, brand_name, category = "Rugs", extract_prompt } = body;

    if (!urls?.length || !brand_name) {
      return new Response(
        JSON.stringify({ error: "urls and brand_name required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt =
      extract_prompt ||
      "Extract: product_name, retail_price_usd (number only, null if unavailable), currency, all_dimensions (all size options in cm as a string), materials, short_description";

    // 1. Submit batch scrape
    const batchRes = await fetch(
      "https://api.firecrawl.dev/v1/batch/scrape",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          urls,
          formats: ["extract"],
          extract: { prompt },
          waitFor: 4000,
        }),
      }
    );

    const batchData = await batchRes.json();
    if (!batchData.success || !batchData.id) {
      return new Response(
        JSON.stringify({
          error: "Batch scrape submission failed",
          detail: batchData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const batchId = batchData.id;
    const statusUrl = `https://api.firecrawl.dev/v1/batch/scrape/${batchId}`;

    // 2. Poll for completion (edge functions have ~400s limit)
    let results: any[] = [];
    let status = "scraping";
    const maxAttempts = 36; // ~6 minutes

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 10000));

      const pollRes = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${firecrawlKey}` },
      });
      const pollData = await pollRes.json();
      status = pollData.status;

      console.log(
        `Poll ${i + 1}: ${status} — ${pollData.completed}/${pollData.total}`
      );

      if (status === "completed") {
        results = pollData.data || [];
        break;
      }

      if (status === "failed" || status === "cancelled") {
        return new Response(
          JSON.stringify({ error: `Batch ${status}`, detail: pollData }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (status !== "completed") {
      return new Response(
        JSON.stringify({
          error: "Batch timed out",
          batch_id: batchId,
          status,
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Upsert into trade_products using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of results) {
      const ext = item.extract || {};
      const meta = item.metadata || {};

      const productName = ext.product_name || ext.productName;
      if (!productName) {
        skipped++;
        continue;
      }

      const retailPrice = ext.retail_price_usd || ext.retailPriceUsd;
      const rrpCents = retailPrice ? Math.round(Number(retailPrice) * 100) : null;
      const dimensions = ext.all_dimensions || ext.allDimensions || null;
      const materials = ext.materials || null;
      const description = ext.short_description || ext.shortDescription || null;
      const imageUrl = meta["og:image"] || null;
      const sourceUrl = meta.sourceURL || meta.url || null;

      // Check if product already exists
      const { data: existing } = await serviceClient
        .from("trade_products")
        .select("id, rrp_price_cents")
        .eq("product_name", productName)
        .eq("brand_name", brand_name)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update with new data if we have it
        const updates: Record<string, any> = {};
        if (rrpCents && !existing[0].rrp_price_cents)
          updates.rrp_price_cents = rrpCents;
        if (dimensions) updates.dimensions = dimensions;
        if (materials) updates.materials = materials;
        if (description) updates.description = description;
        if (imageUrl) updates.image_url = imageUrl;

        if (Object.keys(updates).length > 0) {
          const { error } = await serviceClient
            .from("trade_products")
            .update(updates)
            .eq("id", existing[0].id);
          if (error) {
            errors.push(`Update ${productName}: ${error.message}`);
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        // Insert new product
        const { error } = await serviceClient.from("trade_products").insert({
          product_name: productName,
          brand_name,
          category,
          currency: "USD",
          rrp_price_cents: rrpCents,
          dimensions,
          materials,
          description,
          image_url: imageUrl,
          is_active: true,
        });
        if (error) {
          errors.push(`Insert ${productName}: ${error.message}`);
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        total_scraped: results.length,
        inserted,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("scrape-products error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
