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
      dimensions?: string | null;
      price_cents: number | null;
      currency: string | null;
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
1. ASSISTANT_PROSE — a short reply the assistant is about to send to a professional interior architect. It may accompany a "tearsheet" / quote card, OR it may be a pure discovery / clarification turn with no card at all.
2. GROUND_TRUTH — the exact set of products in the card(s) if any, pulled verbatim from the database (id, title, designer, category, materials, per-brand counts, total). May be empty on discovery turns.
3. CURATION_ALLOWLIST — the ONLY designer / atelier / brand names and piece / product titles the assistant is EVER permitted to name in this conversation, whether or not a card is being sent. This is the full Maison Affluency Curation snapshot the assistant was given.

Your ONLY job: rewrite any sentence in ASSISTANT_PROSE that contradicts GROUND_TRUTH OR names anything outside CURATION_ALLOWLIST. Specifically fix:
- wrong totals ("13 pieces" when GROUND_TRUTH has 12)
- wrong brand attribution ("all Saint-Louis" when the set is mixed; "the Alinea chair" when no Alinea chair exists)
- invented product names or designer names not present in GROUND_TRUTH or CURATION_ALLOWLIST — this includes namedrops on pure discovery turns like "Torus by Poliform", "Luminous Aura by Lasvit", "Helix by Moooi", any Kelly Wearstler / Vincent Van Duysen / Piero Lissoni / Patricia Urquiola / Jean-Michel Frank / etc. mention when they are not in CURATION_ALLOWLIST.designers
- wrong typology claims ("chairs and tables" when the set has only tables)
- wrong material/category claims contradicted by the item rows
- fake apologies or self-corrections ("You're right — I won't present…"), and any mention of external archives like "Axonometric Studio" or "the designers' own collections"

DISCOVERY-TURN RULE: When GROUND_TRUTH.cards is empty, you MUST still strip any specific designer, brand, atelier, studio, maison, or piece title that is not a literal case-insensitive substring of CURATION_ALLOWLIST.designers / CURATION_ALLOWLIST.piece_titles. Rewrite the sentence to keep the qualifying question or atmosphere framing WITHOUT naming any specific brand or piece. Do NOT invent a replacement name. Do NOT say "I could suggest" or "for example".

DO NOT change:
- tone, register, formatting, or paragraph structure
- sentences that are opinions, questions, or non-factual pleasantries
- the assistant's persona ("Felix", "the concierge")
- generic material / typology words (bronze, stone, oak, dining table, chandelier) or place names (Belgravia, Mayfair, London, Paris, Milan, Monaco, New York)
- the word "Maison Affluency" or "Felix"

If the prose is already fully consistent, return it unchanged with an empty corrections array.
NEVER add new product names or designers that aren't in GROUND_TRUTH or CURATION_ALLOWLIST.
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
  allowedDesigners?: string[];
  allowedPieceTitles?: string[];
}): Promise<InspectorResult> {
  const t0 = Date.now();
  const prose = (opts.prose || "").trim();
  const emptyGT =
    !opts.groundTruth?.cards?.length ||
    opts.groundTruth.cards.every((c) => !c.items?.length);
  const hasAllowlist =
    (opts.allowedDesigners?.length || 0) > 0 ||
    (opts.allowedPieceTitles?.length || 0) > 0;

  // Nothing to inspect: no prose at all, OR empty GT AND no allowlist context.
  if (!prose || (emptyGT && !hasAllowlist)) {
    return { ok: true, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "skipped_empty" };
  }
  if (!opts.apiKey) {
    return { ok: false, corrected_prose: prose, corrections: [], ms: Date.now() - t0, reason: "no_api_key" };
  }

  const userPayload = {
    ASSISTANT_PROSE: prose,
    GROUND_TRUTH: opts.groundTruth,
    CURATION_ALLOWLIST: {
      designers: (opts.allowedDesigners || []).slice(0, 400),
      piece_titles: (opts.allowedPieceTitles || []).slice(0, 800),
    },
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

// ---------------------------------------------------------------------------
// Discovery-stage prose guard
// ---------------------------------------------------------------------------
//
// Runs on turns where NO card was emitted (pure discovery / clarification /
// chitchat). Strips any specific product, designer, brand, or atelier name
// that the model may have invented from training data, unless the name is a
// literal substring of the allowlist assembled from the CURATION DATA the
// model was fed this turn.
//
// This is the safety net for the NO-NAMEDROPPING-IN-DISCOVERY rule and the
// "never invent piece names" rule when no ground-truth card exists to diff
// against. Fail-open: on error the original prose is returned unchanged.

export type DiscoveryGuardResult = {
  ok: boolean;
  corrected_prose: string;
  removed_names: string[];
  ms: number;
  reason?: string;
};

const DISCOVERY_GUARD_MODEL = "google/gemini-3.1-flash-lite";
const DISCOVERY_GUARD_TIMEOUT_MS = 2500;

const DISCOVERY_GUARD_SYSTEM = `You are the Discovery Guard — a hallucination scrubber for a luxury B2B interior-design concierge (Felix, Maison Affluency).

You receive:
1. ASSISTANT_PROSE — a discovery / clarification reply the assistant is about to send. NO product card is being sent with it.
2. ALLOWED_DESIGNERS — the ONLY designer / atelier / brand names the assistant is permitted to name.
3. ALLOWED_PIECE_TITLES — the ONLY specific product / piece titles the assistant is permitted to name.

RULES:
- Any proper-noun designer, atelier, brand, studio, or maison name in ASSISTANT_PROSE that is NOT a literal case-insensitive substring of ALLOWED_DESIGNERS must be removed. Examples of names to STRIP if not in the allowlist: Poliform, Lasvit, Moooi, B&B Italia, Cassina, Minotti, Baxter, Flexform, Fendi Casa, Vitra, Herman Miller, Knoll, Roche Bobois, Ligne Roset, Kelly Wearstler, John Pawson, Vincent Van Duysen, Piero Lissoni, Patricia Urquiola, Jean-Michel Frank, etc.
- Any specific PIECE / PRODUCT NAME (usually a quoted or capitalised title like "Torus", "Luminous Aura", "Helix", "Elliptical Dining Table") that is NOT a literal case-insensitive substring of ALLOWED_PIECE_TITLES must be removed. This applies EVEN IF the accompanying designer name IS in the allowlist — piece titles must be verbatim from the allowlist or gone.
- Rewrite the sentence to keep the useful qualifying question or atmosphere framing intact WITHOUT naming any specific brand or piece. Do NOT invent a replacement name. Do NOT say "I could suggest" or "for example" — just drop the namedrop and keep the rest of the sentence readable.
- Do NOT add apologies, do NOT mention external archives ("Axonometric Studio", "designers' own collections"), do NOT self-correct in the prose ("actually, on second thought…").
- Preserve tone, register, paragraph structure, questions, and any user-facing formatting. Keep the assistant's persona (Felix, the concierge).
- The word "Maison Affluency" is always allowed. "Felix" is always allowed. Generic material / typology / colour words are ALWAYS allowed and must NEVER be removed — this includes stone and marble varieties (Calacatta, Statuario, Nero Marquina, Portoro, Verde Alpi, Rosso Levanto, Belgian Bluestone, Grand Antique…), woods (walnut, oak, ebony, rosewood, teak…), metals (bronze, brass, patinated bronze, blackened steel…), textiles (velvet, mohair, boucle, linen, silk, shagreen, parchment…), finishes (crystal, glass, lacquer, cerused, gilt…), colours, and typologies (chandelier, dining table, console, sideboard, sofa, etc.). If the only capitalised span is a material qualifier followed by a material noun ("Nero Marquina marble", "Belgian bluestone"), leave it untouched.
- If the prose is already clean, return it unchanged with an empty removed_names array.

Output STRICT JSON only, no code fences:
{
  "corrected_prose": "<the cleaned (or unchanged) prose>",
  "removed_names": ["<name1>", "<name2>"]
}`;

export async function runDiscoveryProseGuard(opts: {
  prose: string;
  allowedDesigners: string[];
  allowedPieceTitles: string[];
  apiKey: string;
}): Promise<DiscoveryGuardResult> {
  const t0 = Date.now();
  const prose = (opts.prose || "").trim();
  if (!prose) {
    return { ok: true, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: "empty_prose" };
  }
  if (!opts.apiKey) {
    return { ok: false, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: "no_api_key" };
  }

  // Cheap pre-check: if the prose contains no capitalised multi-letter tokens
  // beyond obvious common words, skip the LLM round-trip. Keeps happy-path
  // latency low.
  const capTokens = prose.match(/\b[A-Z][A-Za-z&'’\-]{2,}(?:\s+[A-Z][A-Za-z&'’\-]{2,}){0,3}\b/g) || [];
  const COMMON_STOP = new Set([
    "Maison", "Affluency", "Felix", "I", "The", "This", "That", "You", "Your", "We", "Our",
    "Let", "Would", "Could", "Should", "Once", "For", "With", "And", "But", "Or", "If",
    "Curation", "Discover", "Discovery", "Tearsheet", "Quote", "Showroom", "Gallery",
    "Belgravia", "Mayfair", "London", "Paris", "Milan", "Monaco", "New York",
    // Materials, stones, woods, finishes, colours — descriptive, never brands.
    "Marble", "Stone", "Onyx", "Granite", "Quartzite", "Limestone", "Travertine",
    "Bluestone", "Sandstone", "Slate", "Basalt", "Terrazzo", "Alabaster",
    "Calacatta", "Statuario", "Statuarietto", "Carrara", "Nero", "Marquina",
    "Portoro", "Emperador", "Rosso", "Verde", "Alpi", "Levanto", "Breccia",
    "Bardiglio", "Arabescato", "Paonazzo", "Onice", "Sahara", "Noir",
    "Grand", "Antique", "Belgian", "Italian", "French", "Portuguese", "Spanish",
    "Crystal", "Glass", "Bronze", "Brass", "Copper", "Steel", "Iron", "Pewter",
    "Silver", "Gold", "Rose", "Gilt", "Patinated", "Blackened", "Polished", "Brushed",
    "Walnut", "Oak", "Ash", "Elm", "Cherry", "Maple", "Mahogany", "Ebony", "Teak",
    "Rosewood", "Sycamore", "Pine", "Beech", "Zebrano", "Wenge", "Palisander",
    "Leather", "Velvet", "Mohair", "Linen", "Wool", "Silk", "Cotton", "Bouclé", "Boucle",
    "Lacquer", "Shagreen", "Parchment", "Straw", "Rattan", "Cane", "Cerused",
    "White", "Black", "Cream", "Ivory", "Beige", "Taupe", "Grey", "Gray", "Charcoal",
    "Chandelier", "Table", "Chair", "Sofa", "Console", "Cabinet", "Sideboard",
    "Dining", "Living", "Bedroom", "Salon", "Foyer", "Library", "Study",
  ]);
  const suspicious = capTokens.filter((t) => {
    // Drop if every whitespace-separated part is a stop word
    return !t.split(/\s+/).every((p) => COMMON_STOP.has(p));
  });
  if (!suspicious.length) {
    return { ok: true, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: "no_suspicious_tokens" };
  }

  const userPayload = {
    ASSISTANT_PROSE: prose,
    ALLOWED_DESIGNERS: opts.allowedDesigners.slice(0, 400),
    ALLOWED_PIECE_TITLES: opts.allowedPieceTitles.slice(0, 800),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_GUARD_TIMEOUT_MS);
  try {
    const resp = await fetch(INSPECTOR_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: DISCOVERY_GUARD_MODEL,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DISCOVERY_GUARD_SYSTEM },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!resp.ok) {
      return { ok: false, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: `http_${resp.status}` };
    }
    const j = await resp.json().catch(() => null);
    const raw = j?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return { ok: false, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: "no_content" };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) {
        try { parsed = JSON.parse(fence[1]); } catch { /* fall through */ }
      }
    }
    if (!parsed || typeof parsed.corrected_prose !== "string") {
      return { ok: false, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason: "parse_failed" };
    }
    const removed = Array.isArray(parsed.removed_names)
      ? parsed.removed_names.filter((x: unknown) => typeof x === "string").slice(0, 20).map((s: string) => s.slice(0, 120))
      : [];
    return {
      ok: true,
      corrected_prose: String(parsed.corrected_prose).slice(0, 4000),
      removed_names: removed,
      ms: Date.now() - t0,
    };
  } catch (e) {
    const reason = (e as Error)?.name === "AbortError" ? "timeout" : `error:${(e as Error)?.message || "unknown"}`;
    return { ok: false, corrected_prose: prose, removed_names: [], ms: Date.now() - t0, reason };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallback redactor
// ---------------------------------------------------------------------------
//
// Used when the LLM-based Discovery Guard or Inspector fails to complete
// (timeout, HTTP error, parse failure, no api key). Scans the prose for
// suspicious capitalised multi-letter tokens and strips any span that is
// NOT a case-insensitive substring of the allowlist. Also strips any
// quoted title ("…" / “…”) not present in the piece-title allowlist.
//
// This is deterministic — no network — so it always completes even when
// the guard LLM is down. If the redacted prose ends up substantially
// gutted (e.g. more than 40% of characters removed, or under 40 chars
// left), the caller should fall back to SAFE_FALLBACK_PROSE below.

export const SAFE_FALLBACK_PROSE =
  "Let me pause before naming anything — I want to make sure any piece I mention is actually in the Maison Affluency Curation. Could you tell me a bit more about the atmosphere, palette, and scale you have in mind, and I'll pull a curated first edit against real availability.";

const REDACTOR_STOP = new Set([
  "Maison", "Affluency", "Felix", "I", "The", "This", "That", "You", "Your", "We", "Our",
  "Let", "Would", "Could", "Should", "Once", "For", "With", "And", "But", "Or", "If",
  "Curation", "Discover", "Discovery", "Tearsheet", "Quote", "Showroom", "Gallery",
  "Belgravia", "Mayfair", "London", "Paris", "Milan", "Monaco", "New", "York",
  "Alternatively", "Additionally", "Or", "As",
  // Materials, stones, woods, finishes — these are descriptive, never brands.
  // Capitalised marble / stone varieties frequently appear in atelier prose:
  // "Calacatta", "Nero Marquina", "Statuario", "Belgian Bluestone", "Verde Alpi".
  "Marble", "Stone", "Onyx", "Granite", "Quartzite", "Limestone", "Travertine",
  "Bluestone", "Sandstone", "Slate", "Basalt", "Terrazzo", "Alabaster",
  "Calacatta", "Statuario", "Statuarietto", "Carrara", "Nero", "Marquina",
  "Portoro", "Emperador", "Rosso", "Verde", "Alpi", "Levanto", "Breccia",
  "Bardiglio", "Arabescato", "Paonazzo", "Onice", "Onyx", "Sahara", "Noir",
  "Grand", "Antique", "Belgian", "Italian", "French", "Portuguese", "Spanish",
  "Crystal", "Glass", "Bronze", "Brass", "Copper", "Steel", "Iron", "Pewter",
  "Silver", "Gold", "Rose", "Gilt", "Patinated", "Blackened", "Polished", "Brushed",
  "Walnut", "Oak", "Ash", "Elm", "Cherry", "Maple", "Mahogany", "Ebony", "Teak",
  "Rosewood", "Sycamore", "Pine", "Beech", "Zebrano", "Wenge", "Palisander",
  "Leather", "Velvet", "Mohair", "Linen", "Wool", "Silk", "Cotton", "Bouclé", "Boucle",
  "Lacquer", "Shagreen", "Parchment", "Straw", "Rattan", "Cane", "Cerused",
  "White", "Black", "Cream", "Ivory", "Beige", "Taupe", "Grey", "Gray", "Charcoal",
  "Chandelier", "Table", "Chair", "Sofa", "Console", "Cabinet", "Sideboard",
  "Dining", "Living", "Bedroom", "Salon", "Foyer", "Library", "Study",
]);

// Material nouns that indicate the preceding capitalised span is a
// stone / finish / textile qualifier ("Nero Marquina marble"), not a brand.
const MATERIAL_NOUN_AFTER = new Set([
  "marble", "stone", "onyx", "granite", "quartzite", "limestone", "travertine",
  "bluestone", "sandstone", "slate", "basalt", "terrazzo", "alabaster",
  "wood", "oak", "walnut", "ash", "elm", "cherry", "maple", "mahogany", "ebony", "teak",
  "leather", "velvet", "mohair", "linen", "wool", "silk", "cotton", "bouclé", "boucle",
  "bronze", "brass", "copper", "steel", "iron", "pewter", "silver", "gold",
  "crystal", "glass", "lacquer", "shagreen", "parchment", "straw", "rattan", "cane",
  "finish", "veneer", "inlay", "upholstery", "fabric",
]);

export type DeterministicRedactionResult = {
  redacted_prose: string;
  removed_spans: string[];
  chars_removed: number;
  gutted: boolean; // true when redaction removed too much to send safely
};

export function deterministicRedact(opts: {
  prose: string;
  allowedDesigners: string[];
  allowedPieceTitles: string[];
}): DeterministicRedactionResult {
  const original = (opts.prose || "").trim();
  if (!original) {
    return { redacted_prose: "", removed_spans: [], chars_removed: 0, gutted: false };
  }
  const designerSet = new Set(
    (opts.allowedDesigners || [])
      .map((d) => (d || "").toLowerCase().trim())
      .filter((d) => d.length >= 2),
  );
  const titleSet = new Set(
    (opts.allowedPieceTitles || [])
      .map((t) => (t || "").toLowerCase().trim())
      .filter((t) => t.length >= 2),
  );

  const removed: string[] = [];
  let out = original;

  // 1. Redact quoted titles not in the allowlist.
  out = out.replace(/(['"“‘])([^'"”‘’\n]{2,120})(['"”’])/g, (match, _o, inner) => {
    const key = String(inner).toLowerCase().trim();
    if (!key) return match;
    // Allow if the quoted string appears as a substring of any allowed title,
    // or any allowed title appears inside the quoted string.
    for (const t of titleSet) {
      if (t.includes(key) || key.includes(t)) return match;
    }
    removed.push(`"${inner}"`);
    return "[redacted piece name]";
  });

  // 2. Redact capitalised proper-noun spans (1–4 words) not in allowlists.
  //    We match spans like "Poliform", "B&B Italia", "Kelly Wearstler", "Fendi Casa".
  out = out.replace(
    /\b[A-Z][A-Za-z&'’\-]{2,}(?:\s+[A-Z][A-Za-z&'’\-]{2,}){0,3}\b(\s+[a-z][a-zàâäéèêëîïôöùûüç]+)?/g,
    (span, trailer) => {
      // If the span is immediately followed by a material noun ("Nero
      // Marquina marble", "Belgian bluestone", "Calacatta Viola quartzite"),
      // treat it as a material qualifier, not a brand.
      const trailWord = trailer ? String(trailer).trim().toLowerCase() : "";
      const headSpan = trailer ? span.slice(0, span.length - trailer.length) : span;
      if (trailWord && MATERIAL_NOUN_AFTER.has(trailWord)) return span;
      // Skip if every part is a common stop word
      const parts = headSpan.split(/\s+/);
      if (parts.every((p) => REDACTOR_STOP.has(p))) return span;
      const key = headSpan.toLowerCase();
      // Allowed if the span is a substring of any allowed designer (or vice versa)
      for (const d of designerSet) {
        if (d === key || d.includes(key) || key.includes(d)) return span;
      }
      // Also allow if the span overlaps any allowed piece title in either
      // direction (title-substring-of-span covers cases like "The Calliope
      // Medium Chandelier" containing "Calliope Medium Chandelier").
      for (const t of titleSet) {
        if (t === key || t.includes(key) || key.includes(t)) return span;
      }
      removed.push(headSpan);
      return trailer ? `[redacted]${trailer}` : "[redacted]";
    },
  );

  // Tidy: collapse orphan "by [redacted]" fragments, repeated redaction tags,
  // and dangling connectors so the sentence still reads.
  out = out
    .replace(/\bby\s+\[redacted\]/gi, "")
    .replace(/\bfrom\s+\[redacted\]/gi, "")
    .replace(/\[redacted piece name\]\s+by\s+\[redacted\]/gi, "[redacted]")
    .replace(/(\[redacted\]\s*){2,}/g, "[redacted] ")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  const charsRemoved = Math.max(0, original.length - out.length);
  const gutted =
    out.length < 40 ||
    charsRemoved / Math.max(1, original.length) > 0.4 ||
    (out.match(/\[redacted[^\]]*\]/g) || []).length > 3;

  return { redacted_prose: out, removed_spans: removed, chars_removed: charsRemoved, gutted };
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
        dimensions: p.dimensions ? String(p.dimensions) : null,
        price_cents:
          typeof p.price_cents === "number"
            ? p.price_cents
            : typeof p.trade_price_cents === "number"
              ? p.trade_price_cents
              : typeof p.unit_price_cents === "number"
                ? p.unit_price_cents
                : null,
        currency: p.currency ? String(p.currency) : null,
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
  requirements?: RequirementsInput | null;
  requirements_validation?: RequirementsValidation | null;
};

export function buildInspectorLogRecord(opts: {
  requestId: string;
  originalProse: string;
  result: InspectorResult;
  groundTruth: InspectorGroundTruth;
  requirements?: RequirementsInput | null;
  requirementsValidation?: RequirementsValidation | null;
}): InspectorLogRecord {
  const { requestId, originalProse, result, groundTruth, requirements, requirementsValidation } = opts;
  const aggregatedBrands: Record<string, number> = {};
  for (const c of groundTruth.cards) {
    for (const [k, v] of Object.entries(c.brand_counts || {})) {
      aggregatedBrands[k] = (aggregatedBrands[k] || 0) + v;
    }
  }
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
  const reqOk = requirementsValidation ? requirementsValidation.ok : true;
  const combinedReason = !reqOk
    ? (result.reason ? `${result.reason};requirements_violation` : "requirements_violation")
    : result.reason;
  return {
    tag: "concierge_inspector",
    request_id: requestId,
    ts: new Date().toISOString(),
    ok: result.ok && reqOk,
    ms: result.ms,
    reason: combinedReason,
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
    requirements: requirements ?? null,
    requirements_validation: requirementsValidation ?? null,
  };
}

export function logInspectorRun(record: InspectorLogRecord): void {
  try {
    console.log(JSON.stringify(record));
  } catch {
    console.log(`[concierge_inspector] log-serialize-failed req=${record.request_id}`);
  }
}

// ---------------------------------------------------------------------------
// Requirements coverage validator
// ---------------------------------------------------------------------------
//
// Given the `extract_requirements` payload captured earlier in the turn and
// the ground-truth items the assembled card was built from, verify that every
// requested slot has at least `qty_min` matching items. If any slot is under-
// delivered we surface a structured violation record — the inspector logs it,
// the SSE stream emits it, and the assistant prose can be corrected against
// the shortfall.
//
// The matcher is deliberately lightweight (token / synonym overlap on the
// item's category+title+materials). It is greedy per-slot so a single item
// can only satisfy one slot — this prevents "8 dining chairs" from doubling
// as both the chair slot AND the stool slot.

export type RequirementsSlotInput = {
  typology: string;
  qty_min: number;
  qty_max: number;
  notes?: string;
};

export type RequirementsInput = {
  slots: RequirementsSlotInput[];
  brands?: string[];
  style?: string[];
  materials?: string[];
  room?: string;
  scale?: string;
  era?: string;
  notes?: string;
  budget_cents?: number;
  budget_currency?: string;
};

export type SlotCoverage = {
  typology: string;
  qty_min: number;
  qty_max: number;
  delivered: number;
  matched_ids: string[];
  satisfied: boolean;
};

export type BudgetCheck = {
  requested_cents: number;
  currency: string;
  priced_items: number;
  unpriced_items: number;
  total_cents: number;
  over_by_cents: number;
  ok: boolean;
};

export type PaletteCheck = {
  requested: string[];
  ok: boolean;
  matched_ids: string[];
  offending_ids: string[];
};

export type RequirementsViolation =
  | { kind: "slot_undelivered"; typology: string; qty_min: number; delivered: number }
  | { kind: "slot_overdelivered"; typology: string; qty_max: number; delivered: number }
  | { kind: "brand_mismatch"; requested: string[]; found: string[] }
  | { kind: "budget_over"; requested_cents: number; total_cents: number; currency: string; over_by_cents: number }
  | { kind: "budget_currency_mismatch"; requested: string; found: string[] }
  | { kind: "budget_unpriced"; requested_cents: number; currency: string; unpriced_items: number; unpriced_titles: string[] }
  | { kind: "palette_mismatch"; requested: string[]; offending_ids: string[]; offending_titles: string[] }
  | { kind: "shape_unverified"; requested: string[]; offending_ids: string[]; offending_titles: string[] }
  | { kind: "capacity_unverified"; requested_seats: number; offending_ids: string[]; offending_titles: string[] }
  | { kind: "no_slots" };

export type RequirementsValidation = {
  ok: boolean;
  coverage: SlotCoverage[];
  brand_ok: boolean;
  budget_ok: boolean;
  palette_ok: boolean;
  budget: BudgetCheck | null;
  palette: PaletteCheck | null;
  violations: RequirementsViolation[];
  total_items: number;
  unmatched_ids: string[];
};

// Common typology → keyword synonyms. Keys and values MUST be lowercased.
// Extend conservatively — false positives here mask real violations.
const TYPOLOGY_SYNONYMS: Record<string, string[]> = {
  chair: ["chair", "armchair", "fauteuil", "seat"],
  dining_chair: ["dining chair", "chair", "side chair"],
  side_chair: ["side chair", "chair"],
  lounge_chair: ["lounge chair", "armchair", "club chair"],
  armchair: ["armchair", "fauteuil", "lounge chair"],
  stool: ["stool", "tabouret"],
  bar_stool: ["bar stool", "counter stool", "stool"],
  bench: ["bench", "banquette"],
  sofa: ["sofa", "canape", "settee", "couch"],
  loveseat: ["loveseat", "settee", "sofa"],
  daybed: ["daybed", "chaise"],
  table: ["table"],
  dining_table: ["dining table", "table"],
  coffee_table: ["coffee table", "cocktail table", "low table"],
  side_table: ["side table", "end table", "occasional table"],
  console_table: ["console", "console table"],
  console: ["console", "console table"],
  desk: ["desk", "writing table", "bureau"],
  sideboard: ["sideboard", "credenza", "buffet", "enfilade"],
  cabinet: ["cabinet", "vitrine", "armoire"],
  bookcase: ["bookcase", "bookshelf", "shelving", "shelves"],
  shelf: ["shelf", "shelving", "bookshelf"],
  bed: ["bed", "headboard"],
  nightstand: ["nightstand", "bedside", "night table"],
  dresser: ["dresser", "chest of drawers", "commode"],
  mirror: ["mirror", "miroir"],
  rug: ["rug", "carpet", "tapis", "kilim"],
  chandelier: ["chandelier", "lustre"],
  pendant: ["pendant", "suspension"],
  pendant_light: ["pendant", "suspension"],
  ceiling_light: ["ceiling light", "flush mount", "pendant", "chandelier"],
  floor_lamp: ["floor lamp", "lampadaire"],
  table_lamp: ["table lamp", "lamp"],
  sconce: ["sconce", "wall light", "applique"],
  wall_light: ["sconce", "wall light", "applique"],
  lamp: ["lamp", "lampe"],
  vase: ["vase"],
  bowl: ["bowl", "coupe"],
  tray: ["tray", "plateau"],
  candlestick: ["candlestick", "candelabra", "bougeoir"],
  glassware: ["glass", "tumbler", "goblet", "carafe", "decanter"],
  tableware: ["plate", "bowl", "cup", "saucer", "tableware"],
  artwork: ["artwork", "painting", "print", "photograph"],
  sculpture: ["sculpture", "figurine", "object"],
  screen: ["screen", "paravent", "room divider"],
  ottoman: ["ottoman", "pouf", "footstool"],
};

function normalizeText(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/,.\-()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBudgetFromText(text: string): { cents: number; currency: string } | null {
  const raw = String(text || "");
  const re = /(?:under|below|less\s+than|up\s+to|max(?:imum)?|budget(?:\s+of)?|<=?)\s*(?:about|around|roughly|approx(?:\.)?)?\s*([$€£])?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|m|thousand|million)?\s*(usd|eur|gbp|chf|aed|sgd|hkd|jpy|dollars?|euros?|pounds?)?/i;
  const m = raw.match(re);
  if (!m) return null;
  const sym = m[1] || "";
  const n = Number(String(m[2] || "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const multWord = String(m[3] || "").toLowerCase();
  const mult = multWord === "m" || multWord === "million" ? 1_000_000 : multWord === "k" || multWord === "thousand" ? 1_000 : 1;
  const ccyWord = String(m[4] || "").toLowerCase();
  const currency = sym === "$" || /usd|dollar/.test(ccyWord)
    ? "USD"
    : sym === "£" || /gbp|pound/.test(ccyWord)
      ? "GBP"
      : sym === "€" || /eur|euro/.test(ccyWord)
        ? "EUR"
        : /chf/.test(ccyWord)
          ? "CHF"
          : /aed/.test(ccyWord)
            ? "AED"
            : /sgd/.test(ccyWord)
              ? "SGD"
              : /hkd/.test(ccyWord)
                ? "HKD"
                : /jpy/.test(ccyWord)
                  ? "JPY"
                  : "USD";
  return { cents: Math.round(n * mult * 100), currency };
}

const MATERIAL_KEYWORDS = [
  "walnut", "oak", "bronze", "brass", "marble", "travertine", "stone", "glass", "crystal",
  "leather", "velvet", "mohair", "linen", "wool", "silk", "boucle", "bouclé", "lacquer", "wood",
];

const SHAPE_KEYWORDS = ["rectangular", "rectangle", "round", "oval", "square", "circular", "racetrack"];

function extractSeatCapacity(text: string): number | null {
  const hay = String(text || "").toLowerCase();
  const patterns = [
    /(?:seats?|seating|seat)\s*(?:for)?\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*(?:seats?|seater|person|people)\b/,
  ];
  for (const re of patterns) {
    const m = hay.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 30) return n;
    }
  }
  return null;
}

function extractShapes(text: string): string[] {
  const hay = normalizeText(text);
  return Array.from(new Set(SHAPE_KEYWORDS.filter((s) => hay.includes(s))));
}

export function deriveRequirementsFromText(text: string): RequirementsInput | null {
  const raw = String(text || "");
  const hay = normalizeText(raw);
  const slots: RequirementsSlotInput[] = [];
  if (/\bdining\b/.test(hay) && /\b(table|tables|edit|set)\b/.test(hay)) {
    slots.push({ typology: "dining_table", qty_min: 1, qty_max: 1 });
  } else if (/\btables?\b/.test(hay)) {
    slots.push({ typology: "table", qty_min: 1, qty_max: 1 });
  }
  const materials = Array.from(new Set(MATERIAL_KEYWORDS.filter((m) => hay.includes(normalizeText(m)))));
  const shapes = extractShapes(raw);
  const seats = extractSeatCapacity(raw);
  const budget = parseBudgetFromText(raw);
  const notes = [
    shapes.length ? `shape: ${shapes.join(", ")}` : "",
    seats ? `capacity: seats ${seats}` : "",
  ].filter(Boolean).join("; ");
  const out: RequirementsInput = {
    slots,
    brands: [],
    style: [],
    materials,
    room: /\bdining\b/.test(hay) ? "dining room" : "",
    scale: seats ? `seats ${seats}` : "",
    era: "",
    notes,
  };
  if (budget) {
    out.budget_cents = budget.cents;
    out.budget_currency = budget.currency;
  }
  const meaningful = slots.length || materials.length || shapes.length || seats || budget;
  return meaningful ? out : null;
}

export function mergeRequirementsWithText(
  requirements: RequirementsInput | null | undefined,
  text: string,
): RequirementsInput | null {
  const inferred = deriveRequirementsFromText(text);
  if (!requirements && !inferred) return null;
  if (!requirements) return inferred;
  if (!inferred) return requirements;
  const merged: RequirementsInput = {
    ...requirements,
    slots: Array.isArray(requirements.slots) && requirements.slots.length ? requirements.slots : inferred.slots,
    brands: Array.from(new Set([...(requirements.brands || []), ...(inferred.brands || [])])).filter(Boolean),
    style: Array.from(new Set([...(requirements.style || []), ...(inferred.style || [])])).filter(Boolean),
    materials: Array.from(new Set([...(requirements.materials || []), ...(inferred.materials || [])])).filter(Boolean),
    room: requirements.room || inferred.room || "",
    scale: [requirements.scale, inferred.scale].filter(Boolean).join("; ").slice(0, 160),
    era: requirements.era || inferred.era || "",
    notes: [requirements.notes, inferred.notes].filter(Boolean).join("; ").slice(0, 600),
  };
  if (!merged.budget_cents && inferred.budget_cents) {
    merged.budget_cents = inferred.budget_cents;
    merged.budget_currency = inferred.budget_currency;
  }
  return merged;
}

function keywordsForTypology(typology: string): string[] {
  const raw = normalizeText(typology).replace(/\s+/g, "_");
  const explicit = TYPOLOGY_SYNONYMS[raw];
  if (explicit && explicit.length) return explicit.map(normalizeText);
  const tokens = raw.split("_").filter(Boolean);
  if (!tokens.length) return [];
  const primary = tokens[tokens.length - 1];
  const primarySyn = TYPOLOGY_SYNONYMS[primary];
  const fallback = primarySyn ? primarySyn.map(normalizeText) : [primary];
  return Array.from(new Set([tokens.join(" "), ...fallback]));
}

function itemMatchesTypology(itemText: string, keywords: string[]): boolean {
  if (!itemText || !keywords.length) return false;
  return keywords.some((kw) => kw && itemText.includes(kw));
}

export function validateRequirementsCoverage(
  requirements: RequirementsInput | null | undefined,
  groundTruth: InspectorGroundTruth,
): RequirementsValidation {
  const allItems = groundTruth.cards.flatMap((c) => c.items);
  const totalItems = allItems.length;

  if (!requirements || !Array.isArray(requirements.slots) || requirements.slots.length === 0) {
    return {
      ok: true,
      coverage: [],
      brand_ok: true,
      budget_ok: true,
      palette_ok: true,
      budget: null,
      palette: null,
      violations: requirements ? [{ kind: "no_slots" }] : [],
      total_items: totalItems,
      unmatched_ids: allItems.map((i) => i.id),
    };
  }

  const claimed = new Set<string>();
  const itemText = new Map<string, string>();
  for (const it of allItems) {
    itemText.set(
      it.id,
      normalizeText(`${it.category || ""} ${it.title || ""} ${it.materials || ""} ${it.dimensions || ""}`),
    );
  }

  const coverage: SlotCoverage[] = [];
  const violations: RequirementsViolation[] = [];

  for (const slot of requirements.slots) {
    const kws = keywordsForTypology(slot.typology);
    const qty_min = Math.max(0, Number(slot.qty_min) || 0);
    const qty_max = Math.max(qty_min, Number(slot.qty_max) || qty_min || 0);
    const matched: string[] = [];
    for (const it of allItems) {
      if (claimed.has(it.id)) continue;
      if (qty_max > 0 && matched.length >= qty_max) break;
      if (itemMatchesTypology(itemText.get(it.id) || "", kws)) {
        matched.push(it.id);
        claimed.add(it.id);
      }
    }
    const delivered = matched.length;
    const satisfied = delivered >= qty_min;
    coverage.push({
      typology: slot.typology,
      qty_min,
      qty_max,
      delivered,
      matched_ids: matched,
      satisfied,
    });
    if (!satisfied) {
      violations.push({ kind: "slot_undelivered", typology: slot.typology, qty_min, delivered });
    } else if (qty_max > 0 && delivered > qty_max) {
      violations.push({ kind: "slot_overdelivered", typology: slot.typology, qty_max, delivered });
    }
  }

  let brand_ok = true;
  const requestedBrands = (requirements.brands || [])
    .map((b) => normalizeText(b))
    .filter(Boolean);
  if (requestedBrands.length > 0 && allItems.length > 0) {
    const foundBrandsSet = new Set(
      allItems.map((i) => normalizeText(i.designer || "")).filter(Boolean),
    );
    const overlap = requestedBrands.some((rb) =>
      Array.from(foundBrandsSet).some((fb) => fb.includes(rb) || rb.includes(fb)),
    );
    if (!overlap) {
      brand_ok = false;
      violations.push({
        kind: "brand_mismatch",
        requested: requirements.brands || [],
        found: Array.from(foundBrandsSet),
      });
    }
  }

  // ---- Budget check (hard) ----------------------------------------------
  let budget: BudgetCheck | null = null;
  let budget_ok = true;
  const reqBudget = Number(requirements.budget_cents) > 0 ? Math.floor(Number(requirements.budget_cents)) : 0;
  const reqCurrency = (requirements.budget_currency || "").toUpperCase() || "EUR";
  if (reqBudget > 0 && allItems.length > 0) {
    const priced = allItems.filter((i) => typeof i.price_cents === "number" && (i.price_cents as number) > 0);
    const unpriced = allItems.length - priced.length;
    const foundCurrencies = Array.from(
      new Set(priced.map((i) => (i.currency || "").toUpperCase()).filter(Boolean)),
    );
    if (foundCurrencies.length && !foundCurrencies.every((c) => c === reqCurrency)) {
      budget_ok = false;
      violations.push({ kind: "budget_currency_mismatch", requested: reqCurrency, found: foundCurrencies });
    }
    if (unpriced > 0) {
      budget_ok = false;
      violations.push({
        kind: "budget_unpriced",
        requested_cents: reqBudget,
        currency: reqCurrency,
        unpriced_items: unpriced,
        unpriced_titles: allItems.filter((i) => !(typeof i.price_cents === "number" && (i.price_cents as number) > 0)).slice(0, 8).map((i) => i.title || i.id),
      });
    }
    const total = priced.reduce((acc, i) => acc + Number(i.price_cents || 0), 0);
    const over = total - reqBudget;
    const ok = over <= 0;
    budget = {
      requested_cents: reqBudget,
      currency: reqCurrency,
      priced_items: priced.length,
      unpriced_items: unpriced,
      total_cents: total,
      over_by_cents: Math.max(0, over),
      ok,
    };
    if (!ok) {
      budget_ok = false;
      violations.push({
        kind: "budget_over",
        requested_cents: reqBudget,
        total_cents: total,
        currency: reqCurrency,
        over_by_cents: over,
      });
    }
  }

  // ---- Palette / materials check (hard when materials specified) --------
  let palette: PaletteCheck | null = null;
  let palette_ok = true;
  const requestedPalette = Array.from(
    new Set(
      (requirements.materials || [])
        .concat(requirements.style || [])
        .map((s) => normalizeText(s))
        .filter((s) => s && s.length >= 3),
    ),
  );
  if (requestedPalette.length > 0 && allItems.length > 0) {
    const matched: string[] = [];
    const offending: string[] = [];
    const offendingTitles: string[] = [];
    for (const it of allItems) {
      const hay = itemText.get(it.id) || "";
      const hit = requestedPalette.some((tok) => tok && hay.includes(tok));
      if (hit) matched.push(it.id);
      else {
        offending.push(it.id);
        if (offendingTitles.length < 8) offendingTitles.push(it.title || it.id);
      }
    }
    const ok = offending.length === 0;
    palette = {
      requested: requestedPalette,
      ok,
      matched_ids: matched,
      offending_ids: offending,
    };
    if (!ok) {
      palette_ok = false;
      violations.push({
        kind: "palette_mismatch",
        requested: requestedPalette,
        offending_ids: offending,
        offending_titles: offendingTitles,
      });
    }
  }

  // ---- Shape + seating capacity checks ----------------------------------
  // These are fail-closed verification checks. If the user asked for an
  // 8-seat rectangular dining table, a card must not ship unless the selected
  // dining-table row itself verifies those facts in title/materials/dimensions.
  const requirementText = normalizeText([
    requirements.scale,
    requirements.notes,
    ...(requirements.style || []),
  ].filter(Boolean).join(" "));
  const requestedShapes = Array.from(new Set(SHAPE_KEYWORDS.filter((s) => requirementText.includes(s))));
  const tableItems = allItems.filter((it) => itemMatchesTypology(itemText.get(it.id) || "", keywordsForTypology("dining_table")) || itemMatchesTypology(itemText.get(it.id) || "", keywordsForTypology("table")));
  if (requestedShapes.length && tableItems.length) {
    const offending = tableItems.filter((it) => {
      const hay = itemText.get(it.id) || "";
      return !requestedShapes.some((shape) => hay.includes(shape));
    });
    if (offending.length > 0) {
      violations.push({
        kind: "shape_unverified",
        requested: requestedShapes,
        offending_ids: offending.map((i) => i.id),
        offending_titles: offending.slice(0, 8).map((i) => i.title || i.id),
      });
    }
  }

  const requestedSeats = extractSeatCapacity(`${requirements.scale || ""} ${requirements.notes || ""}`);
  if (requestedSeats && tableItems.length) {
    const minCm = requestedSeats <= 4 ? 120 : requestedSeats <= 6 ? 180 : requestedSeats <= 8 ? 220 : requestedSeats <= 10 ? 280 : 330;
    const dimensionSuggestsCapacity = (dims: string | null | undefined) => {
      const s = String(dims || "").toLowerCase();
      if (!s) return false;
      if (new RegExp(`\\b(?:seats?|seater)\\s*${requestedSeats}\\b|\\b${requestedSeats}\\s*(?:seats?|seater)\\b`).test(s)) return true;
      const nums = Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches|″|")?/g)).map((m) => {
        const n = Number(m[1]);
        const unit = m[2] || "cm";
        if (!Number.isFinite(n)) return 0;
        if (unit === "mm") return n / 10;
        if (unit === "m") return n * 100;
        if (/in|inch|″|"/.test(unit)) return n * 2.54;
        return n;
      }).filter((n) => n > 0 && n < 2000);
      return nums.length > 0 && Math.max(...nums) >= minCm;
    };
    const offending = tableItems.filter((it) => {
      const hay = itemText.get(it.id) || "";
      if (new RegExp(`\\b(?:seats?|seater)\\s*${requestedSeats}\\b|\\b${requestedSeats}\\s*(?:seats?|seater)\\b`).test(hay)) return false;
      return !dimensionSuggestsCapacity(it.dimensions);
    });
    if (offending.length > 0) {
      violations.push({
        kind: "capacity_unverified",
        requested_seats: requestedSeats,
        offending_ids: offending.map((i) => i.id),
        offending_titles: offending.slice(0, 8).map((i) => i.title || i.id),
      });
    }
  }

  const unmatched = allItems.map((i) => i.id).filter((id) => !claimed.has(id));

  return {
    ok: violations.length === 0,
    coverage,
    brand_ok,
    budget_ok,
    palette_ok,
    budget,
    palette,
    violations,
    total_items: totalItems,
    unmatched_ids: unmatched,
  };
}
