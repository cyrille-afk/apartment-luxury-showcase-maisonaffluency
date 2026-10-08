// AI architect layout: admin-only. Arranges catalogue pieces from a brief using the
// approved architect prompt. Output is re-validated client-side (bounds, overlap,
// anchors, 0.6 m gap, trade-cost budget) before anything is shown.
import { requireAdmin } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const INSTRUCTIONS = `You are a principal interior architect and a deterministic JSON generator. Your job is to arrange luxury furniture from an available trade catalog into a 3D bounding box coordinate system based on a client's design brief and trade budget constraints.

### GEOMETRIC & SPATIAL RULES
1. The room origin (0, 0, 0) is the bottom-left corner of the floor grid.
2. 'x' aligns with width_m, 'y' aligns with length_m, and 'z' is elevation from the floor (usually 0 for furniture unless stacked).
3. The 'position' array [x, y, z] must represent the absolute center-point of the item's bounding box.
4. 'rotation' represents clockwise degrees around the Z-axis (0 = facing North/Up, 90 = facing East/Right, 180 = facing South/Down, 270 = facing West/Left).
5. Primary layout logic: Sofas must directly face architectural fireplaces or primary large windows. Accent chairs should flank the main sofa layout at 45 or 90-degree angles.
6. MANDATORY COFFEE TABLE GAP: Coffee tables must be placed exactly 0.6 meters away from the primary sofa edge to ensure luxury hospitality traffic flow.
7. HARD CONSTRAINT: Items MUST NOT collide with architectural_anchors, exceed room_dimensions, or overlap with each other's bounding boxes.

### CURATORIAL & FINANCIAL RULES
1. Select items from \`available_catalog\` that strictly match the design aesthetic specified in \`client_brief\`.
2. BUDGET CAP: The cumulative \`trade_cost\` of all placed items MUST NOT exceed \`client_brief.budget_eur\`. Do not use RRP figures.
3. PRICE UPON REQUEST (POR): Any items missing a numerical \`trade_cost\` value must be ignored completely.

### OUTPUT SCHEMA
You must output a single, valid JSON object following this exact schema. Do not include markdown code blocks, conversational text, commentary, or trailing explanations. Output only the raw string.

{
  "layout_metadata": {
    "total_items_placed": "integer",
    "total_trade_spend_eur": "float",
    "budget_buffer_remaining": "float"
  },
  "placements": [
    {
      "sku": "string",
      "category": "string (e.g., sofa, coffee_table, accent_chair)",
      "position": ["float (x)", "float (y)", "float (z)"],
      "rotation": "integer (0, 90, 180, 270)",
      "layout_logic_justification": "string (15 words max explaining placement choice)"
    }
  ]
}
`;

const num = { type: "number" };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["layout_metadata", "placements"],
  properties: {
    layout_metadata: { type: "object", additionalProperties: false, required: ["total_items_placed", "total_trade_spend_eur", "budget_buffer_remaining"],
      properties: { total_items_placed: { type: "integer" }, total_trade_spend_eur: num, budget_buffer_remaining: num } },
    placements: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["sku", "category", "position", "rotation", "layout_logic_justification"],
      properties: { sku: { type: "string" }, category: { type: "string" }, position: { type: "array", items: num }, rotation: { type: "integer", enum: [0, 90, 180, 270] }, layout_logic_justification: { type: "string" } } } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await requireAdmin(req, "ai-architect-layout");
  if (!auth.ok) return json(auth.body, auth.status);
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "AI is not configured" }, 500);

  let body: { room_dimensions?: unknown; architectural_anchors?: unknown; client_brief?: unknown; available_catalog?: unknown[] };
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (!body.room_dimensions || !body.client_brief || !Array.isArray(body.available_catalog) || body.available_catalog.length > 300) return json({ error: "Invalid request" }, 400);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    signal: req.signal,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: INSTRUCTIONS,
      input: JSON.stringify({ room_dimensions: body.room_dimensions, architectural_anchors: body.architectural_anchors ?? [], client_brief: body.client_brief, available_catalog: body.available_catalog }),
      stream: true,
      store: false,
      reasoning: { effort: "medium" },
      text: { format: { type: "json_schema", name: "architect_layout", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    let msg = "The AI could not generate a layout";
    try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg; } catch { /* keep */ }
    return json({ error: msg }, res.status === 402 || res.status === 403 || res.status === 429 ? res.status : 502);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") return json({ error: "The AI could not generate a layout" }, 502);
      } catch { /* partial */ }
    }
  }
  try { return json({ layout: JSON.parse(text) }); } catch { return json({ error: "The AI returned an unreadable layout" }, 502); }
});
