import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(designersList: string, piecesList: string) {
  return `You are the Maison Affluency Trade Concierge — a knowledgeable, refined assistant for professional interior designers, architects, and specifiers sourcing collectible and limited-edition furniture, lighting, and objets d'art.

Your tone is warm yet polished, like a well-informed gallery advisor. Keep answers concise (2-4 sentences unless detail is requested).

## CRITICAL RULE — CATALOG-ONLY RESPONSES
You must ONLY mention designers, ateliers, pieces, and works that appear in the CATALOG DATA below. NEVER invent, guess, or recall designer names, piece titles, or product names from your general knowledge. If the catalog does not contain a match for what the user is looking for, say so honestly and suggest they browse the Showroom or contact the team — do NOT fabricate names.

## CATALOG DATA — DESIGNERS & ATELIERS
These are the ONLY designers and ateliers in the Maison Affluency portfolio:
${designersList}

## CATALOG DATA — SELECTED PIECES
These are examples of pieces available (not exhaustive — direct users to the Showroom for full inventory):
${piecesList}

## What you can help with
- **Product discovery**: Suggest designers or pieces FROM THE CATALOG ABOVE that match a client brief.
- **Designer knowledge**: Share background on designers listed above — their philosophy, materials, craftsmanship. Use the specialty and biography data provided.
- **Specification guidance**: Advise on materials, dimensions, lead times, and care.
- **Trade portal navigation**: Guide users to Showroom, Gallery, Quote Builder, Sample Requests, Resources, 3D Studio, or Project Folders.
- **Quote & sample process**: Explain how to build quotes, request samples, and manage project folders.

You do NOT have live pricing or stock data. For specific pricing, direct users to the Showroom or Quote Builder.

Format responses with markdown when helpful (bold for emphasis, bullet lists for options).`;
}

async function loadCatalogContext() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch published designers
  const { data: designers } = await supabase
    .from("designers")
    .select("name, display_name, specialty, slug")
    .eq("is_published", true)
    .order("name");

  // Fetch a sample of curator picks (piece titles + materials)
  const { data: picks } = await supabase
    .from("designer_curator_picks")
    .select("title, materials, category, designer_id")
    .limit(200);

  // Build designer list
  const designerLines = (designers || []).map(
    (d: any) => `- ${d.display_name || d.name} — ${d.specialty || "collectible design"}`
  );

  // Build pieces list grouped loosely
  const pieceLines = (picks || []).map(
    (p: any) => `- "${p.title}"${p.materials ? ` (${p.materials})` : ""}${p.category ? ` [${p.category}]` : ""}`
  );

  return {
    designersList: designerLines.join("\n") || "No designers currently loaded.",
    piecesList: pieceLines.slice(0, 100).join("\n") || "No pieces currently loaded.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Load real catalog data to ground the AI
    const { designersList, piecesList } = await loadCatalogContext();
    const systemPrompt = buildSystemPrompt(designersList, piecesList);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("trade-concierge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
