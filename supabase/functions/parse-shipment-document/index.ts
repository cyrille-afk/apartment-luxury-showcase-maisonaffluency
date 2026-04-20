// Phase 3 — AI document intake for the shipping estimator.
// Accepts a PDF/image data URL or pasted email text and returns
// structured shipment fields the estimator can pre-fill.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a logistics intake assistant for a luxury furniture trade portal.
Extract shipment details from the document or email the user provides and return STRICT JSON
matching the requested schema. Use ISO 3166-1 alpha-2 country codes (e.g. IT, FR, SG, HK, AE, US, GB, AU, BE, ES).
If a field is unknown leave it null. Convert all weights to kilograms and all volumes to cubic meters (cbm).
Sum line items into totals. Declared value should be the commercial invoice value as a number (no currency symbol).
Pick category from: furniture, lighting, art, textile, accessory, other.
Pick mode from: sea_lcl, sea_fcl, air, road, courier — or null if unspecified.`;

const TOOL = {
  type: "function",
  function: {
    name: "return_shipment",
    description: "Return the extracted shipment fields.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        origin_country: { type: ["string", "null"] },
        origin_city: { type: ["string", "null"] },
        dest_country: { type: ["string", "null"] },
        dest_city: { type: ["string", "null"] },
        total_volume_cbm: { type: ["number", "null"] },
        total_weight_kg: { type: ["number", "null"] },
        declared_value: { type: ["number", "null"] },
        currency: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        mode: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        confidence: { type: ["number", "null"] },
      },
      required: [
        "origin_country", "origin_city", "dest_country", "dest_city",
        "total_volume_cbm", "total_weight_kg", "declared_value", "currency",
        "category", "mode", "notes", "confidence",
      ],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { text, image_data_url } = body as {
      text?: string;
      image_data_url?: string; // data:image/...;base64,xxxx OR data:application/pdf;base64,xxxx
    };

    if (!text && !image_data_url) {
      return new Response(JSON.stringify({ error: "Provide 'text' or 'image_data_url'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    if (text) userContent.push({ type: "text", text: `Email / document text:\n\n${text}` });
    if (image_data_url) {
      userContent.push({ type: "text", text: "Extract shipment fields from the attached document." });
      userContent.push({ type: "image_url", image_url: { url: image_data_url } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_shipment" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please wait and try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Cloud settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI error: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
