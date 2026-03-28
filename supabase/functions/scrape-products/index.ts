import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PROMPT =
  "Extract: product_name, retail_price_usd (number only, null if unavailable), currency, all_dimensions (all size options in cm as a string), materials, short_description";

async function runScrape(
  serviceClient: any,
  firecrawlKey: string,
  urls: string[],
  brandName: string,
  category: string,
  extractPrompt?: string,
  location?: string
) {
  const prompt = extractPrompt || DEFAULT_PROMPT;

  // 1. Submit batch scrape
  const batchRes = await fetch("https://api.firecrawl.dev/v1/batch/scrape", {
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
      ...(location ? { location: { country: location } } : {}),
    }),
  });

  const batchData = await batchRes.json();
  if (!batchData.success || !batchData.id) {
    return { error: "Batch submission failed", detail: batchData, brand_name: brandName };
  }

  const batchId = batchData.id;
  const statusUrl = `https://api.firecrawl.dev/v1/batch/scrape/${batchId}`;

  // 2. Poll for completion
  let results: any[] = [];
  let status = "scraping";

  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const pollRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${firecrawlKey}` },
    });
    const pollData = await pollRes.json();
    status = pollData.status;
    console.log(`[${brandName}] Poll ${i + 1}: ${status} — ${pollData.completed}/${pollData.total}`);

    if (status === "completed") {
      results = pollData.data || [];
      break;
    }
    if (status === "failed" || status === "cancelled") {
      return { error: `Batch ${status}`, brand_name: brandName };
    }
  }

  if (status !== "completed") {
    return { error: "Batch timed out", batch_id: batchId, brand_name: brandName };
  }

  // 3. Upsert into trade_products
  let inserted = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const item of results) {
    const ext = item.extract || {};
    const meta = item.metadata || {};
    const productName = ext.product_name || ext.productName;
    if (!productName) { skipped++; continue; }

    const retailPrice = ext.retail_price_usd || ext.retailPriceUsd;
    const rrpCents = retailPrice ? Math.round(Number(retailPrice) * 100) : null;
    const dimensions = ext.all_dimensions || ext.allDimensions || null;
    const materials = ext.materials || null;
    const description = ext.short_description || ext.shortDescription || null;
    const imageUrl = meta["og:image"] || null;

    const { data: existing } = await serviceClient
      .from("trade_products")
      .select("id, rrp_price_cents")
      .eq("product_name", productName)
      .eq("brand_name", brandName)
      .limit(1);

    if (existing?.length) {
      const updates: Record<string, any> = {};
      if (rrpCents && !existing[0].rrp_price_cents) updates.rrp_price_cents = rrpCents;
      if (dimensions) updates.dimensions = dimensions;
      if (materials) updates.materials = materials;
      if (description) updates.description = description;
      if (imageUrl) updates.image_url = imageUrl;

      if (Object.keys(updates).length) {
        const { error } = await serviceClient.from("trade_products").update(updates).eq("id", existing[0].id);
        if (error) errors.push(`Update ${productName}: ${error.message}`);
        else updated++;
      } else {
        skipped++;
      }
    } else {
      const { error } = await serviceClient.from("trade_products").insert({
        product_name: productName,
        brand_name: brandName,
        category,
        currency: "USD",
        rrp_price_cents: rrpCents,
        dimensions, materials, description,
        image_url: imageUrl,
        is_active: true,
      });
      if (error) errors.push(`Insert ${productName}: ${error.message}`);
      else inserted++;
    }
  }

  return {
    brand_name: brandName,
    batch_id: batchId,
    total_scraped: results.length,
    inserted, updated, skipped,
    errors: errors.length ? errors : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));

    // Mode 1: Scheduled run — process all active configs
    if (body.scheduled === true) {
      const { data: configs } = await serviceClient
        .from("scrape_configs")
        .select("*")
        .eq("is_active", true)
        .not("schedule_cron", "is", null);

      if (!configs?.length) {
        return new Response(JSON.stringify({ message: "No active scheduled configs" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allResults = [];
      for (const config of configs) {
        const result = await runScrape(
          serviceClient, firecrawlKey,
          config.urls, config.brand_name, config.category, config.extract_prompt
        );
        allResults.push(result);

        // Update last_run
        await serviceClient.from("scrape_configs").update({
          last_run_at: new Date().toISOString(),
          last_run_result: result,
          updated_at: new Date().toISOString(),
        }).eq("id", config.id);
      }

      return new Response(JSON.stringify({ success: true, results: allResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Manual run — requires auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2a: Run a saved config by id
    if (body.config_id) {
      const { data: config } = await serviceClient
        .from("scrape_configs")
        .select("*")
        .eq("id", body.config_id)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await runScrape(
        serviceClient, firecrawlKey,
        config.urls, config.brand_name, config.category, config.extract_prompt
      );

      await serviceClient.from("scrape_configs").update({
        last_run_at: new Date().toISOString(),
        last_run_result: result,
        updated_at: new Date().toISOString(),
      }).eq("id", config.id);

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2b: Multi-brand inline scrape
    const brands = body.brands || (body.urls && body.brand_name
      ? [{ urls: body.urls, brand_name: body.brand_name, category: body.category || "Uncategorized" }]
      : []);

    if (!brands.length) {
      return new Response(JSON.stringify({ error: "No brands/urls provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save configs if requested
    if (body.save_configs) {
      for (const b of brands) {
        await serviceClient.from("scrape_configs").upsert({
          brand_name: b.brand_name,
          category: b.category || "Uncategorized",
          urls: b.urls,
          extract_prompt: b.extract_prompt || null,
          schedule_cron: b.schedule_cron || null,
          is_active: true,
          created_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "brand_name" }).select();
      }
    }

    const allResults = [];
    for (const b of brands) {
      const result = await runScrape(
        serviceClient, firecrawlKey,
        b.urls, b.brand_name, b.category || "Uncategorized", b.extract_prompt, b.location
      );
      allResults.push(result);
    }

    return new Response(JSON.stringify({
      success: true,
      results: allResults,
      summary: {
        brands: allResults.length,
        total_inserted: allResults.reduce((s, r) => s + (r.inserted || 0), 0),
        total_updated: allResults.reduce((s, r) => s + (r.updated || 0), 0),
        total_skipped: allResults.reduce((s, r) => s + (r.skipped || 0), 0),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scrape-products error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
