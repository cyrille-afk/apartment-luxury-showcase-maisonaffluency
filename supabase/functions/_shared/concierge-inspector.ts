// Inspector Agent — second-pass validator for the trade-concierge assistant.
//
// Given the assistant's about-to-be-shown prose AND the ground-truth product
// rows the tearsheet/quote card was built from, this asks a cheap fast model
// to diff the prose against the JSON facts and rewrite any sentence that
// contradicts the data (wrong counts, wrong brand attribution, invented
// pieces/designers, wrong typology, wrong dimensions/price if quoted).
//
// It is intentionally scoped to *factual* corrections. Tone, structure and
// length must be preserved. On any error/timeout the original prose is
// returned unchanged (fail-open — the card itself is already ground-truth).

export type InspectorGroundTruth = {
  cards: Array<{
    tool: string; // propose_tearsheet | add_to_tearsheet | draft_quote | ...
    total: number;
    brand_counts: Record<string, number>; // { "Alinea": 8, "Saint-Louis": 4 }
    items: Array<{
      id: string;
      title: string;
      designer: string | null;
      category: string | null;
      materials: string | null;
    }>;
  }>;
};

export type InspectorResult = {
  ok: boolean;
  corrected_prose: string;
  corrections: Array<{ original: string; replacement: string; reason: string }>;
  ms: number;
  reason?: string; // populated when ok=false (timeout / parse fail / etc)
};

const INSPECTOR_MODEL = "google/gemini-3.1-flash-lite";
const INSPECTOR_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const INSPECTOR_TIMEOUT_MS = 2500;

const SYSTEM_PROMPT = `You are the Inspector — a factual-compliance auditor for a luxury B2B interior-design concierge.

You are given:
1. ASSISTANT_PROSE — a short reply the assistant is about to send to a professional interior architect. It usually accompanies a "tearsheet" (visual product card) or a quote card.
2. GROUND_TRUTH — the exact set of products in the card(s), pulled verbatim from the database (id, title, designer, category, materials, per-brand counts, total).

Your ONLY job: rewrite any sentence in ASSISTANT_PROSE that contradicts GROUND_TRUTH. Specifically fix:
- wrong totals ("13 pieces" when GROUND_TRUTH has 12)
- wrong brand attribution ("all Saint-Louis" when the set is mixed; "the Alinea chair" when no Alinea chair exists)
- invented product names or designer names not present in GROUND_TRUTH
- wrong typology claims ("chairs and tables" when the set has only tables)
- wrong material/category claims contradicted by the item rows

DO NOT change:
- tone, register, formatting, or paragraph structure
- sentences that are opinions, questions, or non-factual pleasantries
- the assistant's persona ("Felix", "the concierge")

If the prose is already fully consistent with GROUND_TRUTH, return it unchanged with an empty corrections array.
NEVER add new product names or designers that aren't in GROUND_TRUTH.
NEVER invent prices, dimensions, or lead times.

Output STRICT JSON only, no code fences:
{
  "corrected_prose": "<the rewritten (or unchanged) prose>",
  "corrections": [
    { "original": "<verbatim snippet from ASSISTANT_PROSE>", "replacement": "<what it was rewritten to>", "reason": "<one short sentence>" }
  ]
}`;

export async function runInspectorPass(opts: {
  prose: string;
  groundTruth: InspectorGroundTruth;
  apiKey: string;
}): Promise<InspectorResult> {
  const t0 = Date.now();
  const prose = (opts.prose || "").trim();
  const emptyGT =
    !opts.groundTruth?.cards?.length ||
    opts.groundTruth.cards.every((c) => !c.items?.length);

  // Nothing to inspect.
  if (!prose || emptyGT) {
    return { ok: true, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "skipped_empty" };
  }
  if (!opts.apiKey) {
    return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "no_api_key" };
  }

  const userPayload = {
    ASSISTANT_PROSE: prose,
    GROUND_TRUTH: opts.groundTruth,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSPECTOR_TIMEOUT_MS);
  try {
    const resp = await fetch(INSPECTOR_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: INSPECTOR_MODEL,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!resp.ok) {
      return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: `http_${resp.status}` };
    }
    const j = await resp.json().catch(() => null);
    const raw = j?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "no_content" };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to unwrap ```json ... ``` fences the model may have added.
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) {
        try { parsed = JSON.parse(fence[1]); } catch { /* fall through */ }
      }
    }
    if (!parsed || typeof parsed.corrected_prose !== "string") {
      return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "parse_failed" };
    }
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections
          .filter((c: any) => c && typeof c.original === "string" && typeof c.replacement === "string")
          .slice(0, 8)
          .map((c: any) => ({
            original: String(c.original).slice(0, 500),
            replacement: String(c.replacement).slice(0, 500),
            reason: String(c.reason || "").slice(0, 240),
          }))
      : [];
    return {
      ok: true,
      corrected_prose: String(parsed.corrected_prose).slice(0, 4000),
      corrections,
      ms: Date.now() - t0,
    };
  } catch (e) {
    const reason = (e as Error)?.name === "AbortError" ? "timeout" : `error:${(e as Error)?.message || "unknown"}`;
    return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason };
  } finally {
    clearTimeout(timer);
  }
}

// Build the compact ground-truth object from emitted tool-call buffers +
// hydrated preview rows. Cheap and pure — no I/O.
export function buildInspectorGroundTruth(
  cards: Array<{ tool: string; pickIds: string[]; previews: Array<any> }>,
): InspectorGroundTruth {
  const out: InspectorGroundTruth = { cards: [] };
  for (const c of cards) {
    const items = (c.previews || [])
      .filter((p) => p && typeof p.id === "string")
      .map((p) => ({
        id: String(p.id),
        title: String(p.title || p.product_name || ""),
        designer: p.designer_name ? String(p.designer_name) : null,
        category: p.category ? String(p.category) : null,
        materials: p.materials ? String(p.materials) : null,
      }));
    const brand_counts: Record<string, number> = {};
    for (const it of items) {
      const k = it.designer || "Unknown";
      brand_counts[k] = (brand_counts[k] || 0) + 1;
    }
    out.cards.push({
      tool: c.tool,
      total: items.length,
      brand_counts,
      items,
    });
  }
  return out;
}

// Build a single structured log record describing one Inspector run.
// Emitted as one JSON line via console.log so it's greppable in edge logs
// and joinable to a request via request_id.
export type InspectorLogRecord = {
  tag: "concierge_inspector";
  request_id: string;
  ts: string;
  ok: boolean;
  ms: number;
  reason?: string;
  card_types: string[];
  card_totals: number[];
  brand_counts: Record<string, number>;
  prose_len: number;
  corrected_len: number;
  changed: boolean;
  corrections_count: number;
  corrections: Array<{ original: string; replacement: string; reason: string }>;
  original_prose: string;
  corrected_prose: string;
  ground_truth: InspectorGroundTruth;
};

export function buildInspectorLogRecord(opts: {
  requestId: string;
  originalProse: string;
  result: InspectorResult;
  groundTruth: InspectorGroundTruth;
}): InspectorLogRecord {
  const { requestId, originalProse, result, groundTruth } = opts;
  const aggregatedBrands: Record<string, number> = {};
  for (const c of groundTruth.cards) {
    for (const [k, v] of Object.entries(c.brand_counts || {})) {
      aggregatedBrands[k] = (aggregatedBrands[k] || 0) + v;
    }
  }
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
  return {
    tag: "concierge_inspector",
    request_id: requestId,
    ts: new Date().toISOString(),
    ok: result.ok,
    ms: result.ms,
    reason: result.reason,
    card_types: groundTruth.cards.map((c) => c.tool),
    card_totals: groundTruth.cards.map((c) => c.total),
    brand_counts: aggregatedBrands,
    prose_len: originalProse.length,
    corrected_len: result.corrected_prose.length,
    changed: result.ok && result.corrected_prose.trim() !== originalProse.trim(),
    corrections_count: result.corrections.length,
    corrections: result.corrections,
    original_prose: clip(originalProse, 4000),
    corrected_prose: clip(result.corrected_prose, 4000),
    ground_truth: groundTruth,
  };
}

export function logInspectorRun(record: InspectorLogRecord): void {
  try {
    console.log(JSON.stringify(record));
  } catch {
    console.log(`[concierge_inspector] log-serialize-failed req=${record.request_id}`);
  }
}
