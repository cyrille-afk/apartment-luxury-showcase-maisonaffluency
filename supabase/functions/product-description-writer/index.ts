import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brands where a single creative director is responsible for the entire collection.
// When the product has no explicit designer subtitle, fall back to crediting this person.
const CREATIVE_DIRECTOR_BY_BRAND: Record<string, string> = {
  "okha": "Adam Court",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  editorial: `Write in an evocative, editorial tone suited for a luxury design journal or Instagram caption. 
Reference the designer's philosophy and creative vision. Use sensory language about materials and craftsmanship. 
Keep it 2-3 paragraphs. Do NOT include dimensions or pricing.`,

  technical: `Write a precise technical specification suitable for a trade spec sheet or quote document.
Lead with materials, dimensions, and edition details. Include lead time if available.
Use clear, professional language. Keep it 1-2 short paragraphs followed by bullet points for key specs.`,

  seo: `Write a concise, SEO-optimized product description for a luxury furniture website.
Naturally incorporate the designer name, brand, material keywords, and category.
Lead with one compelling sentence, then 1-2 short supporting sentences.

STRICT LENGTH: 90-105 words TOTAL. Approximately 600-680 characters. Never exceed 110 words. This is a hard limit — count your words before responding and trim aggressively if over.

Output a SINGLE paragraph. No line breaks, no bullet points, no multiple paragraphs.

Do NOT mention dimensions, measurements, sizes, depth, width, height, lead times, production time, delivery, or made-to-order timing — these are shown elsewhere on the product card.
Do NOT list finish options or material variants exhaustively — reference materials evocatively, not as a spec sheet.
Do NOT use keyword stuffing — keep it elegant, scannable, and informative.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, source, tone } = await req.json();

    if (!product_id || !source || !tone) {
      return new Response(
        JSON.stringify({ error: "product_id, source ('curator_picks' or 'trade_products'), and tone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!TONE_INSTRUCTIONS[tone]) {
      return new Response(
        JSON.stringify({ error: `Invalid tone. Use: ${Object.keys(TONE_INSTRUCTIONS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let productContext = "";

    if (source === "curator_picks") {
      const { data: pick, error } = await supabase
        .from("designer_curator_picks")
        .select("title, subtitle, materials, dimensions, category, subcategory, edition, description, lead_time, photo_credit, designer_id")
        .eq("id", product_id)
        .single();

      if (error || !pick) {
        return new Response(
          JSON.stringify({ error: "Product not found in curator picks" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch parent brand/atelier context
      const { data: brand } = await supabase
        .from("designers")
        .select("name, display_name, specialty, philosophy, biography, founder")
        .eq("id", pick.designer_id)
        .single();

      const brandName = brand?.display_name || brand?.name || "Unknown";

      // The subtitle MAY contain the actual creator name (e.g. "Yabu Pushelberg" for a Man of Parts piece),
      // BUT it is often used as a variant/material descriptor (e.g. "Rock Crystal", "Lounge Chair",
      // "Special Shade", "Natural Distress Shagreen"). We must NOT treat material/variant text as a designer.
      // Heuristic: only treat subtitle as a designer credit when it looks like a personal/studio name
      // AND does not match common material/variant vocabulary.
      const rawSubtitle = (pick.subtitle || "").trim();
      const VARIANT_KEYWORDS = /\b(crystal|shade|straw|shagreen|bronze|brass|marble|wood|leather|linen|silk|velvet|lacquer|gesso|parchment|stone|glass|ceramic|porcelain|oak|walnut|teak|rosewood|ash|maple|onyx|travertine|alabaster|terracotta|rattan|wicker|cane|metal|steel|iron|copper|gold|silver|nickel|chrome|matte|gloss|satin|polished|brushed|antique|distressed|natural|clear|smoked|tinted|frosted|ombr[ée]|finish|colou?r|wall art|table|chair|lamp|sconce|sofa|bench|console|cabinet|desk|stool|mirror|rug|vase|bowl|box|tray|lounge|dining|side|coffee|floor|ceiling|pendant|chandelier)\b/i;
      const looksLikePersonName = /^[A-Z][a-zà-ÿ]+(?:[\s&\-][A-Z][a-zà-ÿ]+)+$/.test(rawSubtitle);
      const subtitleIsLikelyDesigner = !!rawSubtitle && looksLikePersonName && !VARIANT_KEYWORDS.test(rawSubtitle);

      let actualDesigner = subtitleIsLikelyDesigner ? rawSubtitle : "";
      const variantDescriptor = subtitleIsLikelyDesigner ? "" : rawSubtitle;
      let cleanTitle = pick.title;
      if (!actualDesigner) {
        const m = pick.title.match(/^(.*?)\s+by\s+(.+?)\s*$/i);
        if (m && m[2] && m[2].toLowerCase() !== brandName.toLowerCase() && !VARIANT_KEYWORDS.test(m[2])) {
          cleanTitle = m[1].trim();
          actualDesigner = m[2].trim();
        }
      }
      // Creative director fallback — for brands like OKHA, Adam Court should always be credited
      // even when the product subtitle is empty or holds a variant descriptor.
      const creativeDirector = CREATIVE_DIRECTOR_BY_BRAND[brandName.toLowerCase()];
      if (!actualDesigner && creativeDirector) {
        actualDesigner = creativeDirector;
      }
      const isCollaboration = !!actualDesigner && actualDesigner.toLowerCase() !== brandName.toLowerCase();
      const isCreativeDirectorCredit = !!creativeDirector && actualDesigner === creativeDirector;

      productContext = `
## PRODUCT DATA
- **Title**: ${cleanTitle}
- **Designed by**: ${actualDesigner || brandName}
- **Brand / Atelier**: ${brandName}${isCreativeDirectorCredit ? ` (${actualDesigner} is creative director)` : isCollaboration ? ` (commissioned the piece from ${actualDesigner})` : ""}
- **Materials**: ${pick.materials || "Not specified"}
- **Dimensions**: ${pick.dimensions || "Not specified"}
- **Category**: ${pick.category || ""}${pick.subcategory ? ` > ${pick.subcategory}` : ""}
- **Variant / Finish**: ${variantDescriptor || "N/A"}
- **Edition**: ${pick.edition || "Not specified"}
- **Lead Time**: ${pick.lead_time || "Not specified"}
- **Photo Credit**: ${pick.photo_credit || "N/A"}
- **Existing Description**: ${pick.description || "None — generate from scratch"}

## BRAND / ATELIER CONTEXT (publisher of the piece)
- **Name**: ${brandName}
- **Founder**: ${brand?.founder || "N/A"}
- **Specialty**: ${brand?.specialty || "Collectible design"}
- **Philosophy**: ${brand?.philosophy || "Not available"}
- **Biography excerpt**: ${(brand?.biography || "").slice(0, 600)}
${isCreativeDirectorCredit ? `
## ATTRIBUTION RULE
${actualDesigner} is the CREATIVE DIRECTOR of ${brandName} and is responsible for the design of this piece.
Always credit the design to ${actualDesigner} for ${brandName} (e.g. "by ${actualDesigner} for ${brandName}").
Never imply the piece was designed anonymously by ${brandName} alone — ${actualDesigner}'s authorship must be named.` : isCollaboration ? `
## ATTRIBUTION RULE
This piece was DESIGNED BY ${actualDesigner} and PRODUCED/PUBLISHED BY ${brandName}.
Always credit the design to ${actualDesigner}. You may reference ${brandName} as the atelier/editor that commissioned or produces the piece.
Never imply the piece was designed by ${brandName} or its founder.` : ""}
`;
    } else {
      const { data: product, error } = await supabase
        .from("trade_products")
        .select("product_name, brand_name, category, subcategory, materials, dimensions, description, lead_time")
        .eq("id", product_id)
        .single();

      if (error || !product) {
        return new Response(
          JSON.stringify({ error: "Product not found in trade products" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to find designer info by brand name
      const { data: designer } = await supabase
        .from("designers")
        .select("name, display_name, specialty, philosophy, biography, founder")
        .or(`name.ilike.%${product.brand_name}%,display_name.ilike.%${product.brand_name}%`)
        .limit(1)
        .maybeSingle();

      productContext = `
## PRODUCT DATA
- **Product Name**: ${product.product_name}
- **Brand**: ${product.brand_name}
- **Materials**: ${product.materials || "Not specified"}
- **Dimensions**: ${product.dimensions || "Not specified"}
- **Category**: ${product.category || ""}${product.subcategory ? ` > ${product.subcategory}` : ""}
- **Lead Time**: ${product.lead_time || "Not specified"}
- **Existing Description**: ${product.description || "None — generate from scratch"}
${designer ? `
## DESIGNER CONTEXT
- **Name**: ${designer.display_name || designer.name}
- **Founder**: ${designer.founder || "N/A"}
- **Specialty**: ${designer.specialty || "Collectible design"}
- **Philosophy**: ${designer.philosophy || "Not available"}
- **Biography excerpt**: ${(designer.biography || "").slice(0, 600)}
` : ""}`;
    }

    const systemPrompt = `You are a luxury design copywriter for Maison Affluency, a curated platform for collectible furniture, lighting, and objets d'art. 
You write with precision and taste, like a gallery press release merged with Architectural Digest editorial standards.

${TONE_INSTRUCTIONS[tone]}

RULES:
- ONLY use information provided in the PRODUCT DATA and DESIGNER CONTEXT below. Do NOT invent details.
- If a field says "Not specified", omit it rather than guessing.
- Never mention pricing.
- Write in third person.
- Output ONLY the description text — no titles, headers, or meta commentary.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a ${tone} product description using the following data:\n${productContext}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ description, tone, product_id, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("product-description-writer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
