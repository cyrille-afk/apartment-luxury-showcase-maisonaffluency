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
