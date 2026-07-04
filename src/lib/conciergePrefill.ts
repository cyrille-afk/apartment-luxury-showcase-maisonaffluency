// Small helper for the concierge cards: build a targeted "swap this SKU"
// prompt and hand it to the AIConcierge composer via the existing
// `concierge:stage` custom-event bus. Kept in one place so every card
// (tearsheet, quote, FF&E) sends the SAME shape of prompt.
//
// Contract:
//   - Dispatches a `concierge:stage` CustomEvent with { openPanel: true, prefill }.
//   - AIConcierge listens, opens the panel, sets the textarea value, and
//     focuses it — the user reviews / edits, then hits Send.
//   - We deliberately do NOT auto-send. Prefill is an affordance, not an
//     action; the architect must confirm.

export type SwapPromptItem = {
  pick_id: string;
  title?: string | null;
  designer_name?: string | null;
  materials?: string | null;
  category?: string | null;
};

// Short-form SKU we surface in the user-facing prompt. Full UUIDs are noisy;
// the first block (8 chars) is unique enough for the model to disambiguate
// when the ID also appears in CURATED PIECES that turn.
export function shortSku(pickId: string): string {
  const s = String(pickId || "").trim();
  const first = s.split("-")[0] || s;
  return first.slice(0, 8).toUpperCase();
}

const WOODY_TOKENS = [
  "wood", "oak", "walnut", "ash", "teak", "mahogany", "cherry", "pine",
  "rosewood", "beech", "maple", "elm", "birch", "ebony",
];

function finishClause(materials: string | null | undefined): string {
  const m = String(materials || "").toLowerCase();
  if (WOODY_TOKENS.some((t) => m.includes(t))) {
    return "in a darker wood finish (walnut, smoked oak, wengé or similar)";
  }
  // Non-wood pieces still get a directional finish nudge so the model has
  // something concrete to search against.
  return "in a darker, richer material palette (deeper stain, patinated metal, or a warmer stone)";
}

export function buildSwapPrompt(item: SwapPromptItem): string {
  const sku = shortSku(item.pick_id);
  const title = String(item.title || "this piece").trim();
  const designer = item.designer_name ? ` by ${item.designer_name}` : "";
  const category = item.category ? ` (${item.category})` : "";
  return [
    `Swap "${title}"${designer}${category} (SKU ${sku}) for a similar piece — ${finishClause(item.materials)}.`,
    `Match the same typology, scale, and role in the set. Keep every other pick unchanged.`,
    `Return the updated selection using \`add_to_tearsheet\` on the ACTIVE board with real pick_ids from CURATED PIECES only.`,
  ].join(" ");
}

// Regenerate every UNLOCKED pick in the current draft while keeping the
// locked ones verbatim. `locked` should list every pick the user has
// explicitly frozen (🔒). The model must return a new proposal that includes
// those exact pick_ids plus fresh alternatives for the rest.
export function buildRegenerateUnlockedPrompt(locked: SwapPromptItem[], unlockedCount: number): string {
  const lockedLines = locked.map((it) => {
    const sku = shortSku(it.pick_id);
    const title = String(it.title || "piece").trim();
    const designer = it.designer_name ? ` — ${it.designer_name}` : "";
    return `  • "${title}"${designer} (SKU ${sku}) [id: ${it.pick_id}]`;
  });
  const lockedBlock = lockedLines.length ? lockedLines.join("\n") : "  (none)";
  const replaceCount = Math.max(unlockedCount, 0);
  const noun = replaceCount === 1 ? "piece" : "pieces";
  return [
    `Re-generate the unlocked ${noun} in the current tearsheet draft.`,
    `\n\nLOCKED — retain verbatim in the new proposal (SAME pick_ids, do NOT alter or drop):\n${lockedBlock}`,
    `\n\nReplace the remaining ${replaceCount} unlocked ${noun} with fresh alternatives that match the same brief, typology, scale, and role.`,
    `\nReturn the updated selection using the SAME tool as the current draft with real pick_ids from CURATED PIECES only.`,
  ].join("");
}

// ─── Live suggestion (#2) ────────────────────────────────────────────────
// Ask the AI to fill one more slot that harmonises with the current selection.
// The prompt is deliberately open — the model uses the KEPT context (already
// injected on every turn) to know what "harmonises" means for THIS draft.
export function buildSuggestOneMorePrompt(kept: SwapPromptItem[], gapHint?: string): string {
  const anchorLines = kept.slice(0, 8).map((it) => {
    const title = String(it.title || "piece").trim();
    const designer = it.designer_name ? ` — ${it.designer_name}` : "";
    return `  • "${title}"${designer}`;
  });
  const anchorBlock = anchorLines.length ? anchorLines.join("\n") : "  (none)";
  const hint = gapHint?.trim()
    ? `\n\nGAP TO FILL: ${gapHint.trim()}`
    : `\n\nSuggest what the room is missing (e.g. a light source, a soft counterpoint, an accent piece) — do not add more of what is already there.`;
  return [
    `Add ONE more piece to the current tearsheet draft that harmonises with what I've kept.${hint}`,
    `\n\nCURRENT SELECTION (retain all of these verbatim):\n${anchorBlock}`,
    `\n\nCall \`add_to_tearsheet\` on the ACTIVE board with pick_ids = ALL kept ids + your ONE new pick_id from CURATED PIECES. Include a \`pick_rationales\` entry for the new pick explaining why it fills the gap.`,
  ].join("");
}

// ─── Critique & Explain (#3) ─────────────────────────────────────────────
// Ask the concierge to comment on the architect's manual edits vs the
// original AI proposal — what shifted in the design (palette, weight,
// price posture) and whether anything now conflicts. Read-only critique;
// the model should NOT emit a tool call.
export function buildCritiqueEditsPrompt(
  original: SwapPromptItem[],
  kept: SwapPromptItem[],
  skipped: SwapPromptItem[],
  locked: SwapPromptItem[],
): string {
  const fmt = (it: SwapPromptItem) => {
    const title = String(it.title || "piece").trim();
    const designer = it.designer_name ? ` — ${it.designer_name}` : "";
    const mat = it.materials ? ` (${it.materials})` : "";
    return `  • "${title}"${designer}${mat}`;
  };
  const block = (arr: SwapPromptItem[]) => (arr.length ? arr.map(fmt).join("\n") : "  (none)");
  return [
    `Critique my manual edits to the current tearsheet draft. Do NOT emit any tool call — reply as prose only.`,
    `\n\nORIGINAL PROPOSAL (what you first suggested):\n${block(original)}`,
    `\n\nKEPT (still in the draft):\n${block(kept)}`,
    `\n\nSKIPPED by me (removed):\n${block(skipped)}`,
    `\n\nLOCKED 🔒 by me (frozen as the design anchor):\n${block(locked)}`,
    `\n\nIn 3–5 short paragraphs, walk me through:`,
    `\n1. How my edits shift the palette, weight, silhouette language, or price posture vs your original.`,
    `\n2. What the locked pieces reveal about the direction I'm anchoring (materials, designer language, era).`,
    `\n3. Any tension or gap my edits introduce (missing typology, palette clash, scale imbalance).`,
    `\n4. ONE concrete next move you'd recommend (a swap, an addition, a room reframing) — but do not execute it.`,
    `\n\nBe specific and editorial. Reference pieces by title, not by id.`,
  ].join("");
}

// ─── Seed extraction (#4) ────────────────────────────────────────────────
// Detect micro-patterns from the architect's manual edits (skipped + locked)
// so the next AI turn can lean into what they anchored and avoid what they
// rejected. Returns a compact directive string to inject as a system-user
// context message, or null when there aren't enough signals to be useful.

const MATERIAL_TOKENS = [
  "oak", "walnut", "ash", "teak", "mahogany", "cherry", "pine", "rosewood",
  "beech", "maple", "elm", "birch", "ebony", "wood",
  "brass", "bronze", "copper", "steel", "iron", "chrome", "aluminium", "aluminum", "nickel",
  "marble", "travertine", "onyx", "granite", "limestone", "alabaster", "stone",
  "leather", "velvet", "linen", "silk", "wool", "cotton", "boucle", "bouclé", "cashmere", "mohair",
  "glass", "crystal", "ceramic", "porcelain", "lacquer", "rattan", "cane", "wicker",
  "matte", "gloss", "polished", "brushed", "patinated", "smoked", "burnished", "raw", "natural",
];

function extractTokens(materials: string | null | undefined): string[] {
  if (!materials) return [];
  const lower = materials.toLowerCase();
  return MATERIAL_TOKENS.filter((t) => lower.includes(t));
}

function topRepeats(items: SwapPromptItem[], min = 2): { materials: string[]; designers: string[] } {
  const matCount = new Map<string, number>();
  const desCount = new Map<string, number>();
  for (const it of items) {
    for (const tok of extractTokens(it.materials)) matCount.set(tok, (matCount.get(tok) || 0) + 1);
    const d = (it.designer_name || "").trim();
    if (d) desCount.set(d, (desCount.get(d) || 0) + 1);
  }
  const materials = Array.from(matCount.entries()).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  const designers = Array.from(desCount.entries()).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return { materials, designers };
}

/**
 * Build a "leanings & aversions" directive from manual edit signals. Returns
 * null when the signals are too weak (fewer than 2 repeats on any axis) so we
 * don't pollute the prompt with noise from a single skip/lock.
 */
export function buildSeedDirective(locked: SwapPromptItem[], skipped: SwapPromptItem[]): string | null {
  const leans = topRepeats(locked, 2);
  const avoids = topRepeats(skipped, 2);
  const hasSignal =
    leans.materials.length > 0 || leans.designers.length > 0 ||
    avoids.materials.length > 0 || avoids.designers.length > 0;
  if (!hasSignal) return null;

  const lines: string[] = [
    `[Design DNA extracted from the architect's manual edits — apply as a soft directive on the next proposal.]`,
  ];
  if (leans.materials.length || leans.designers.length) {
    const parts: string[] = [];
    if (leans.materials.length) parts.push(`materials/finishes: ${leans.materials.join(", ")}`);
    if (leans.designers.length) parts.push(`designer language: ${leans.designers.join(", ")}`);
    lines.push(`LEAN INTO (repeatedly locked by the user): ${parts.join(" · ")}.`);
  }
  if (avoids.materials.length || avoids.designers.length) {
    const parts: string[] = [];
    if (avoids.materials.length) parts.push(`materials/finishes: ${avoids.materials.join(", ")}`);
    if (avoids.designers.length) parts.push(`designer language: ${avoids.designers.join(", ")}`);
    lines.push(`AVOID (repeatedly skipped by the user): ${parts.join(" · ")}.`);
  }
  lines.push(`Treat these as revealed preference — favour new picks that reinforce the LEAN axis and steer away from the AVOID axis, unless the user explicitly overrides.`);
  return lines.join("\n");
}

// Fire the prompt into the AIConcierge composer. Safe to call from any
// concierge card. No-op in non-browser environments.
export function sendConciergePrefill(prompt: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("concierge:stage", {
        detail: { openPanel: true, prefill: prompt },
      }),
    );
  } catch {
    // Best-effort; the button just does nothing rather than throw.
  }
}
