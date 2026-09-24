import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

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
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  {
    const __auth = await requireCronOrAdmin(req, "embed-product");
    if (!__auth.ok) {
      return new Response(JSON.stringify(__auth.body), { status: __auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { productId, designerName, verbatimTitle, rawDescription, dimensionsString } = await req.json();
    if (!productId || !designerName || !verbatimTitle) {
      return new Response(JSON.stringify({ error: "productId, designerName and verbatimTitle are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Structure the messy catalog record into a clean semantic chunk + taxonomy.
    const aiData = await gatewayPost("/chat/completions", lovableApiKey, {
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert data parsing agent for high-end furniture. Take the input and return a JSON object with:
  "clean_chunk": A highly descriptive, dense, scholarly paragraph capturing the item's form, silhouette, materiality, and style heritage. Avoid generic marketing fluff.
  "taxonomy": An array of lowercase design tags (e.g. ["brutalist", "monastic", "travertine", "matte"]).
  "dimensions": A clean json object with keys: width_mm, depth_mm, height_mm (numbers or null when unknown).`,
        },
        {
          role: "user",
          content: `Title: ${verbatimTitle}. Designer: ${designerName}. Description: ${rawDescription ?? ""}. Dimensions: ${dimensionsString ?? ""}`,
        },
      ],
    });
    const structuredInsights = JSON.parse(aiData.choices[0].message.content);

    // 2. Generate the 1536-dimension vector embedding (must match product_embeddings.embedding).
    const embeddingData = await gatewayPost("/embeddings", lovableApiKey, {
      model: "openai/text-embedding-3-small",
      input: structuredInsights.clean_chunk,
    });
    const embedding = embeddingData.data[0].embedding;

    // 3. Idempotent ingestion: one embedding row per catalog product.
    const { error: upsertError } = await supabase
      .from("product_embeddings")
      .upsert(
        {
          product_id: productId,
          designer_name: designerName,
          verbatim_title: verbatimTitle,
          dimensions_json: structuredInsights.dimensions,
          design_taxonomy: structuredInsights.taxonomy,
          content_chunk: structuredInsights.clean_chunk,
          embedding: JSON.stringify(embedding),
        },
        { onConflict: "product_id" },
      );
    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ success: true, message: "Catalog item tokenized and embedded." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
