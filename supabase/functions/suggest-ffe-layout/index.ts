import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { modelFor } from "../_shared/aiModels.ts";

const FFE_MODEL = modelFor("strong");
// gemini-2.5-pro burns reasoning tokens before emitting the tool call.
// With a 400-item catalog the 2048 default ran out → no tool_call → "AI returned no layout."
const FFE_MAX_TOKENS = 8192;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Brief {
  rooms?: string[];
  style?: string;
  budget?: string;
  notes?: string;
}

const ALLOWED_CATEGORIES = [
  "seating", "sofa", "armchair", "lounge chair", "dining chair", "stool",
  "tables", "coffee table", "side table", "dining table", "console", "desk",
  "lighting", "floor lamp", "table lamp", "pendant", "chandelier", "wall light",
  "case goods", "credenza", "sideboard", "bookshelf",
  "rugs", "rug",
  "bedroom", "bed", "nightstand", "dresser",
  "outdoor",
];

async function loadCatalog() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  const { data: picks } = await sb
    .from("designer_curator_picks")
    .select("id, title, subtitle, category, subcategory, materials, dimensions, image_url, designer_id")
    .eq("is_hidden", false)
    .limit(180);

  const { data: designers } = await sb
    .from("designers")
    .select("id, name, display_name")
    .eq("is_published", true);

  const designerMap = new Map<string, string>();
  (designers || []).forEach((d: any) => designerMap.set(d.id, d.display_name || d.name));

  return (picks || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    designer: designerMap.get(p.designer_id) || "",
    category: p.category || "",
    subcategory: p.subcategory || "",
    materials: p.materials || "",
    dimensions: p.dimensions || "",
    image_url: p.image_url,
  }));
}

function buildSystemPrompt(catalog: any[]) {
  const compact = catalog.map((c) =>
    `- ${c.id} | ${c.title} | ${c.designer} | ${c.category}${c.subcategory ? "/" + c.subcategory : ""} | ${c.materials || ""}`
  ).join("\n");

  return `You are an expert FF&E specifier for Maison Affluency. You will look at a floor plan image and a brief, then propose a furniture layout drawn ONLY from the catalog below.

ABSOLUTE RULES:
- Only propose products by their exact catalog id from the list. Never invent products.
- Group placements by room. Use the room names from the user's brief; if you can read room labels on the plan, prefer those.
- For each placement, return normalised coordinates x,y in the range [0,1] (relative to the floor plan image), plus a width w and height h in [0.05, 0.4] representing footprint, plus rotation in degrees [0,360].
- Provide a short reason per item (max 18 words).
- Be conservative — 4-10 items per room maximum.

CATALOG (id | title | designer | category | materials):
${compact}

Return tool call only — no prose.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const token = auth.replace("Bearer ", "");
    const { data: claims } = await sb.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_image_url, brief } = await req.json() as { plan_image_url: string; brief: Brief };
    if (!plan_image_url || typeof plan_image_url !== "string") {
      return new Response(JSON.stringify({ error: "plan_image_url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch the floor plan, validate by magic bytes, and inline as base64 so
    // Gemini never has to fetch the signed URL itself. PDFs are rejected with
    // a clear, actionable message (the upload path now converts PDFs → PNG,
    // but older saved plans may still be PDFs).
    let imageUrlForAI = plan_image_url;
    try {
      const planResp = await fetch(plan_image_url);
      if (!planResp.ok) {
        return new Response(JSON.stringify({ error: `Could not load floor plan (status ${planResp.status}). Please re-upload it.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const buf = new Uint8Array(await planResp.arrayBuffer());
      const isPdf = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      const isJpg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
      const isGif = buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
      const isWebp = buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
        && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
      if (isPdf) {
        return new Response(JSON.stringify({
          error: "This floor plan is a PDF. Click 'Replace plan' and upload it again — the new uploader auto-converts PDFs to images.",
          code: "PDF_PLAN",
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(isPng || isJpg || isGif || isWebp)) {
        return new Response(JSON.stringify({
          error: "Floor plan must be a PNG, JPG, GIF or WebP image. Please re-upload.",
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mime = isPng ? "image/png" : isJpg ? "image/jpeg" : isGif ? "image/gif" : "image/webp";
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < buf.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)) as any);
      }
      imageUrlForAI = `data:${mime};base64,${btoa(bin)}`;
    } catch (e) {
      console.error("Floor plan fetch/validate failed", e);
      return new Response(JSON.stringify({ error: "Could not read the uploaded floor plan. Please re-upload it as a PNG or JPG image." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catalog = await loadCatalog();
    const system = buildSystemPrompt(catalog);

    const userText = `Brief:
- Rooms: ${(brief?.rooms || []).join(", ") || "(detect from plan)"}
- Style: ${brief?.style || "(unspecified)"}
- Budget: ${brief?.budget || "(unspecified)"}
- Notes: ${brief?.notes || "(none)"}

Look at the floor plan image and propose an FF&E layout per room.`;

    const tools = [{
      type: "function",
      function: {
        name: "propose_layout",
        description: "Return the proposed FF&E layout per room with placement coords.",
        parameters: {
          type: "object",
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  summary: { type: "string", description: "1-sentence styling rationale." },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product_id: { type: "string", description: "Exact catalog id." },
                        reason: { type: "string" },
                        x: { type: "number" }, y: { type: "number" },
                        w: { type: "number" }, h: { type: "number" },
                        rotation: { type: "number" },
                      },
                      required: ["product_id", "reason", "x", "y", "w", "h", "rotation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "summary", "items"],
                additionalProperties: false,
              },
            },
          },
          required: ["rooms"],
          additionalProperties: false,
        },
      },
    }];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FFE_MODEL,
        max_completion_tokens: FFE_MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageUrlForAI } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "propose_layout" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — please retry in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let detail = "AI service error";
      try {
        const j = JSON.parse(t);
        detail = j?.error?.message || detail;
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: detail }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    logAiUsage({ feature: "suggest-ffe-layout", model: FFE_MODEL, usage: aiJson?.usage }).catch(() => {});
    const choice = aiJson?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (toolCall) {
      try { parsed = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* fallthrough */ }
    }
    // Fallback: some models occasionally emit JSON in message.content when tool_choice fails.
    if (!parsed) {
      const raw = (choice?.message?.content || "").toString();
      const match = raw.match(/\{[\s\S]*"rooms"[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
      }
    }
    if (!parsed?.rooms) {
      const finish = choice?.finish_reason || "unknown";
      console.error("suggest-ffe-layout: no tool_call", {
        finish,
        usage: aiJson?.usage,
        snippet: (choice?.message?.content || "").toString().slice(0, 300),
      });
      const msg = finish === "length"
        ? "The AI ran out of tokens before completing the layout. Try again with a simpler brief."
        : "AI returned no layout. Please try again — if it persists, simplify the brief.";
      return new Response(JSON.stringify({ error: msg, finish_reason: finish }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hydrate items with catalog details for the frontend
    const catalogById = new Map(catalog.map((c) => [c.id, c]));
    const rooms = (parsed.rooms || []).map((r: any) => ({
      ...r,
      items: (r.items || [])
        .map((it: any) => {
          const p = catalogById.get(it.product_id);
          if (!p) return null;
          return { ...it, product: p };
        })
        .filter(Boolean),
    }));

    return new Response(JSON.stringify({ rooms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-ffe-layout error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
