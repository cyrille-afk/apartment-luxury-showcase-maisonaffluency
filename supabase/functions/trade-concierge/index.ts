import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_tearsheet",
      description:
        "Draft a NEW tearsheet (client board) for the trade user. Only call this when the user clearly asks to assemble, save, group, or share a selection of pieces. Always pick IDs strictly from CATALOG PIECES — never invent IDs.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "A short, evocative title for the tearsheet (max 80 chars).",
          },
          pick_ids: {
            type: "array",
            description: "UUIDs of curator picks to include. Must come from CATALOG PIECES.",
            items: { type: "string" },
            minItems: 1,
            maxItems: 24,
          },
          note: {
            type: "string",
            description: "Optional 1–2 sentence rationale shown alongside the tearsheet.",
          },
        },
        required: ["title", "pick_ids"],
        additionalProperties: false,
      },
    },
  },
];

function buildSystemPrompt(designersList: string, piecesList: string, showroomBrands: string) {
  return `You are the Maison Affluency Trade Concierge — a knowledgeable, refined assistant for professional interior designers, architects, and specifiers sourcing collectible and limited-edition furniture, lighting, and objets d'art.

Your tone is warm yet polished, like a well-informed gallery advisor. Keep answers concise (2-4 sentences unless detail is requested).

## ABSOLUTE RULE — CATALOG-ONLY RESPONSES
You must ONLY mention designers, ateliers, pieces, brands, and works that appear in the CATALOG DATA sections below.
- NEVER invent, guess, or recall designer names, piece titles, product names, or brand names from your general training knowledge.
- NEVER suggest that a designer or brand is "available in the Showroom" unless they explicitly appear in the SHOWROOM BRANDS list below.
- If the user asks about a designer or brand NOT in the lists below, say: "I don't currently have [name] in our catalog. Would you like me to suggest similar designers from our collection, or shall I connect you with the team?"
- Do NOT fabricate piece names, even for designers that ARE in the catalog. Only mention specific pieces listed in CATALOG PIECES below.
- BEFORE saying you don't have a match, you MUST scan the entire CATALOG PIECES list including the materials field of each line. The list IS complete — there is nothing hidden. Refuse only after a real scan.

## TOOL USE — TEARSHEET DRAFTING
You can draft a tearsheet (client board) for the user via the \`propose_tearsheet\` tool.
- Only call it when the user explicitly asks to "build", "create", "assemble", "save", or "draft" a tearsheet / mood board / selection.
- pick_ids MUST be the exact UUIDs shown in square brackets next to each pick in CATALOG PIECES below.
- Do NOT call the tool just to recommend pieces in conversation — only when the user wants to PERSIST a selection.
- After calling the tool, give one short sentence telling the user the draft is ready for their review (it will appear as an approval card; nothing is saved until they approve).

## CATALOG DATA — DESIGNERS & ATELIERS
These are the ONLY designers and ateliers in the Maison Affluency portfolio:
${designersList}

## CATALOG DATA — PIECES
Each line is formatted: \`- "title" by Designer (materials · category) [id: <uuid>]\`. Use those IDs verbatim when calling propose_tearsheet.

When a user asks for pieces in a specific material, finish, or wood (e.g. "oak", "walnut", "marble", "brass", "leather"), you MUST scan the materials field of every pick below and return ALL matches — not just the first one you remember. The catalog below is COMPLETE; if you cannot find a match after scanning, only then say so.

${piecesList}

## SHOWROOM BRANDS
These are the ONLY brands with products currently browsable in the Showroom:
${showroomBrands}

If a brand is in DESIGNERS but NOT in SHOWROOM BRANDS, tell the user: "We represent [name] but their pieces are currently available by inquiry only — I can connect you with the team."

## What you can help with
- **Product discovery**: Suggest designers or pieces FROM THE CATALOG ABOVE that match a client brief.
- **Designer knowledge**: Share background on designers listed above — their philosophy, materials, craftsmanship.
- **Specification guidance**: Advise on materials, dimensions, lead times, and care for cataloged pieces.
- **Trade portal navigation**: Guide users to Showroom, Gallery, Quote Builder, Sample Requests, Resources, 3D Studio, or Project Folders.
- **Tearsheet drafting**: When asked, assemble a tearsheet via the tool above.

You do NOT have live pricing or stock data. For specific pricing, direct users to the Quote Builder.

Format responses with markdown when helpful (bold for emphasis, bullet lists for options).`;
}

async function loadCatalogContext(supabase: ReturnType<typeof createClient>) {
  // Fetch published designers
  const { data: designers } = await supabase
    .from("designers")
    .select("id, name, display_name, specialty, slug")
    .eq("is_published", true)
    .order("name");

  const designerMap = new Map<string, string>();
  (designers || []).forEach((d: any) => {
    designerMap.set(d.id, d.display_name || d.name);
  });

  // Fetch ALL curator picks WITH IDs (the model needs them for tool calling).
  // Order deterministically so the catalog is stable across requests.
  const { data: picks } = await supabase
    .from("designer_curator_picks")
    .select("id, title, materials, category, designer_id")
    .order("designer_id", { ascending: true })
    .order("title", { ascending: true })
    .limit(2000);

  const { data: hotspotBrands } = await supabase
    .from("gallery_hotspots")
    .select("designer_name");

  const { data: tradeProducts } = await supabase
    .from("trade_products")
    .select("brand_name")
    .eq("is_active", true);

  const designerLines = (designers || []).map(
    (d: any) => `- ${d.display_name || d.name} — ${d.specialty || "collectible design"}`
  );

  const pieceLines = (picks || []).map((p: any) => {
    const designer = designerMap.get(p.designer_id) || "Unknown";
    const meta = [p.materials, p.category].filter(Boolean).join(" · ");
    return `- "${p.title}" by ${designer}${meta ? ` (${meta})` : ""} [id: ${p.id}]`;
  });

  const brandSet = new Set<string>();
  (hotspotBrands || []).forEach((h: any) => { if (h.designer_name) brandSet.add(h.designer_name); });
  (tradeProducts || []).forEach((t: any) => { if (t.brand_name) brandSet.add(t.brand_name); });
  const showroomBrandLines = Array.from(brandSet).sort().map(b => `- ${b}`);

  return {
    designersList: designerLines.join("\n") || "No designers currently loaded.",
    piecesList: pieceLines.join("\n") || "No pieces currently loaded.",
    showroomBrands: showroomBrandLines.join("\n") || "No showroom brands currently loaded.",
  };
}

/** Hydrate a list of pick IDs into a preview the chat UI can render. */
async function hydratePickPreview(
  supabase: ReturnType<typeof createClient>,
  pickIds: string[],
) {
  if (!pickIds.length) return [];
  const { data } = await supabase
    .from("designer_curator_picks")
    .select("id, title, image_url, materials, category, designer_id")
    .in("id", pickIds);

  const designerIds = Array.from(new Set((data || []).map((p: any) => p.designer_id).filter(Boolean)));
  const { data: designers } = designerIds.length
    ? await supabase.from("designers").select("id, name, display_name").in("id", designerIds)
    : { data: [] as any[] };
  const dmap = new Map<string, string>();
  (designers || []).forEach((d: any) => dmap.set(d.id, d.display_name || d.name));

  // Preserve original order from the model
  const byId = new Map((data || []).map((p: any) => [p.id, p]));
  return pickIds
    .map((id) => {
      const p = byId.get(id);
      if (!p) return null;
      return {
        id: p.id,
        title: p.title,
        image_url: p.image_url,
        materials: p.materials,
        category: p.category,
        designer_name: dmap.get(p.designer_id) || null,
      };
    })
    .filter(Boolean);
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { designersList, piecesList, showroomBrands } = await loadCatalogContext(supabase);
    const systemPrompt = buildSystemPrompt(designersList, piecesList, showroomBrands);

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: TOOLS,
          tool_choice: "auto",
          stream: true,
        }),
      }
    );

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await upstream.text();
      console.error("AI gateway error:", upstream.status, text);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: "No response stream" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream interceptor: pass text deltas through, but accumulate any tool_calls
    // and emit a single `event: proposal` SSE frame once the tool call is complete.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // tool_calls arrive as fragments; key by index
    const toolCallBuffers = new Map<number, { id?: string; name?: string; argsText: string }>();
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const flushProposal = async () => {
          for (const tc of toolCallBuffers.values()) {
            if (tc.name !== "propose_tearsheet") continue;
            let parsed: any = null;
            try { parsed = JSON.parse(tc.argsText || "{}"); } catch (e) {
              console.error("Could not parse tool args:", tc.argsText, e);
              continue;
            }
            const pickIds: string[] = Array.isArray(parsed.pick_ids) ? parsed.pick_ids : [];
            const preview = await hydratePickPreview(supabase, pickIds);
            const proposal = {
              tool: "propose_tearsheet",
              tool_call_id: tc.id || crypto.randomUUID(),
              args: {
                title: typeof parsed.title === "string" ? parsed.title : "Untitled tearsheet",
                pick_ids: pickIds,
                note: typeof parsed.note === "string" ? parsed.note : null,
              },
              preview,
            };
            controller.enqueue(encoder.encode(`event: proposal\ndata: ${JSON.stringify(proposal)}\n\n`));
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);

              // Pass through SSE comments / blanks unchanged
              if (line === "" || line.startsWith(":")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }
              if (!line.startsWith("data: ")) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }

              const payload = line.slice(6).trim();
              if (payload === "[DONE]") {
                await flushProposal();
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const obj = JSON.parse(payload);
                const delta = obj.choices?.[0]?.delta;
                const toolCalls = delta?.tool_calls;
                if (Array.isArray(toolCalls)) {
                  for (const tc of toolCalls) {
                    const idx = typeof tc.index === "number" ? tc.index : 0;
                    const buf = toolCallBuffers.get(idx) ?? { argsText: "" };
                    if (tc.id) buf.id = tc.id;
                    if (tc.function?.name) buf.name = tc.function.name;
                    if (typeof tc.function?.arguments === "string") buf.argsText += tc.function.arguments;
                    toolCallBuffers.set(idx, buf);
                  }
                  // Don't forward raw tool_call deltas to the client; we emit a proposal event instead.
                  continue;
                }
                // Plain text delta — forward unchanged
                controller.enqueue(encoder.encode(line + "\n"));
              } catch {
                // Forward unparseable lines as-is so the client can attempt recovery
                controller.enqueue(encoder.encode(line + "\n"));
              }
            }
          }
          // Stream ended without [DONE] — still flush any pending proposal
          await flushProposal();
        } catch (e) {
          console.error("stream interceptor error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
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
