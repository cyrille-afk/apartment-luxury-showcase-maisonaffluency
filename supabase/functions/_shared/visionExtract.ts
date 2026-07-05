// Multimodal extraction: turn a mood board, floor plan, product photo, or
// tearsheet into structured JSON the concierge can feed into pgvector +
// SQL search.
//
// Uses Lovable AI Gateway (google/gemini-2.5-pro for spatial reasoning,
// google/gemini-3-flash-preview for the lighter cases). Text-only prompts
// fall through unchanged; on gateway failure we return null and the caller
// degrades to text-only retrieval.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type VisionKind = "mood_board" | "floor_plan" | "product_photo" | "tearsheet";

export interface ExtractedVision {
  kind: VisionKind;
  // Aesthetic signals — fed into the embedding query text.
  style: string[];              // e.g. ["mid-century", "warm minimal"]
  palette: string[];            // e.g. ["ivory", "walnut", "brushed brass"]
  materials: string[];          // e.g. ["boucle", "travertine"]
  // Structural signals — fed into match_catalog_filtered `filter` jsonb.
  categories: string[];         // e.g. ["seating", "lighting"]
  subcategories: string[];      // e.g. ["sofa", "pendant"]
  room_type: string | null;     // e.g. "living room"
  designer_hints: string[];     // any designers named / recognised
  max_width_cm: number | null;
  max_depth_cm: number | null;
  max_height_cm: number | null;
  max_lead_weeks: number | null;
  budget_currency: string | null;
  budget_max: number | null;
  notes: string;                // free-text summary for the concierge
}

const SCHEMA_PROMPT_BY_KIND: Record<VisionKind, string> = {
  mood_board:
    "You are analysing an interior mood board. Identify the dominant style vocabulary, colour palette, and materials. Infer likely furniture categories and, if any pieces are recognisable, name the designer or maker. Do not invent dimensions.",
  floor_plan:
    "You are analysing a floor plan or room drawing. Identify the room type and the maximum footprint any single furniture piece could occupy (in centimetres). If wall lengths or a scale bar are visible, use them; otherwise leave dimensions null. Do not invent styles or materials.",
  product_photo:
    "You are analysing a photograph of an existing furniture piece the client wants to match. Extract category, subcategory, materials, and palette. If the piece resembles work by a known designer, name them as a hint only.",
  tearsheet:
    "You are analysing a PDF/tearsheet page. Extract designer, category, subcategory, materials, dimensions (cm), lead time (weeks), and any budget indication.",
};

const OUTPUT_INSTRUCTION = `Return ONLY a JSON object with these keys (unknowns as null / empty array):
{
  "style": string[],
  "palette": string[],
  "materials": string[],
  "categories": string[],
  "subcategories": string[],
  "room_type": string | null,
  "designer_hints": string[],
  "max_width_cm": number | null,
  "max_depth_cm": number | null,
  "max_height_cm": number | null,
  "max_lead_weeks": number | null,
  "budget_currency": string | null,
  "budget_max": number | null,
  "notes": string
}
No commentary. No markdown fences.`;

const MODEL_BY_KIND: Record<VisionKind, string> = {
  mood_board: "google/gemini-3-flash-preview",
  floor_plan: "google/gemini-2.5-pro",       // spatial reasoning needs the strong tier
  product_photo: "google/gemini-3-flash-preview",
  tearsheet: "google/gemini-2.5-pro",        // documents benefit from long-context reasoning
};

export interface ExtractOptions {
  apiKey: string;
  kind: VisionKind;
  /** https URL that the provider can fetch. Prefer signed URLs for private buckets. */
  imageUrl?: string;
  /** Base64-encoded PDF (no data: prefix). Alternative to imageUrl for tearsheets. */
  pdfBase64?: string;
  /** Optional user text describing what they're looking for; sharpens extraction. */
  userText?: string;
}

export async function extractFromMedia(opts: ExtractOptions): Promise<ExtractedVision | null> {
  const { apiKey, kind } = opts;
  if (!apiKey) return null;
  if (!opts.imageUrl && !opts.pdfBase64) return null;

  const content: any[] = [
    {
      type: "text",
      text:
        SCHEMA_PROMPT_BY_KIND[kind] +
        (opts.userText ? `\n\nUser context: ${opts.userText.slice(0, 500)}` : "") +
        "\n\n" +
        OUTPUT_INSTRUCTION,
    },
  ];
  if (opts.imageUrl) {
    content.push({ type: "image_url", image_url: { url: opts.imageUrl } });
  } else if (opts.pdfBase64) {
    content.push({
      type: "file",
      file: {
        filename: "attachment.pdf",
        file_data: `data:application/pdf;base64,${opts.pdfBase64}`,
      },
    });
  }

  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_BY_KIND[kind],
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => null) as any;
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) return null;
      const parsed = safeJson(raw);
      if (!parsed) return null;
      return normaliseExtracted(kind, parsed);
    }

    if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      continue;
    }

    const errText = await resp.text().catch(() => "");
    console.error("[visionExtract] gateway error", resp.status, errText.slice(0, 300));
    return null;
  }
  return null;
}

function safeJson(text: string): any | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to locate the first {...} block.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0 && x.length < 120)
    .slice(0, 12);
}

function asNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normaliseExtracted(kind: VisionKind, raw: any): ExtractedVision {
  return {
    kind,
    style: asStringArray(raw?.style),
    palette: asStringArray(raw?.palette),
    materials: asStringArray(raw?.materials),
    categories: asStringArray(raw?.categories),
    subcategories: asStringArray(raw?.subcategories),
    room_type: typeof raw?.room_type === "string" ? raw.room_type.trim() || null : null,
    designer_hints: asStringArray(raw?.designer_hints),
    max_width_cm: asNumberOrNull(raw?.max_width_cm),
    max_depth_cm: asNumberOrNull(raw?.max_depth_cm),
    max_height_cm: asNumberOrNull(raw?.max_height_cm),
    max_lead_weeks: asNumberOrNull(raw?.max_lead_weeks),
    budget_currency: typeof raw?.budget_currency === "string" ? raw.budget_currency.trim() || null : null,
    budget_max: asNumberOrNull(raw?.budget_max),
    notes: typeof raw?.notes === "string" ? raw.notes.slice(0, 800) : "",
  };
}

/** Build an augmented query string for the embedding + text search. */
export function toEmbeddingQuery(v: ExtractedVision, userText?: string): string {
  const parts: string[] = [];
  if (userText?.trim()) parts.push(userText.trim());
  if (v.style.length) parts.push(`style: ${v.style.join(", ")}`);
  if (v.palette.length) parts.push(`palette: ${v.palette.join(", ")}`);
  if (v.materials.length) parts.push(`materials: ${v.materials.join(", ")}`);
  if (v.subcategories.length) parts.push(v.subcategories.join(", "));
  else if (v.categories.length) parts.push(v.categories.join(", "));
  if (v.designer_hints.length) parts.push(`by ${v.designer_hints.join(" or ")}`);
  return parts.join(" · ").slice(0, 1200);
}

/** Build the jsonb filter passed to match_catalog_filtered. */
export function toStructuralFilter(v: ExtractedVision): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (v.categories[0]) filter.category = v.categories[0];
  if (v.subcategories[0]) filter.subcategory = v.subcategories[0];
  if (v.designer_hints[0]) filter.designer = v.designer_hints[0];
  if (v.max_lead_weeks) filter.max_lead_weeks = v.max_lead_weeks;
  return filter;
}
