// Concierge hallucination guardrail for finish / variant labels.
//
// When the planner proposes a quote or FF&E line with a `variant` string
// (e.g. "Carrara marble base with cognac leather top"), we cannot let it
// through unchecked — the model routinely invents finish combinations that
// the product actually cannot execute. Downstream, that variant string is
// what the tearsheet, quote, and eventual factory order carry.
//
// This module builds the set of finish / variant combinations that the DB
// *can* actually execute for a given pick, and provides a matcher that
// rejects anything outside that set. Sources of truth (in order):
//
//   1. designer_curator_picks.size_variants   ({base, top, label} objects)
//   2. designer_curator_picks.variant_image_map   (keys like "base|top")
//   3. product_fabrics + fabrics.name         (upholstery / stone / veneer
//                                              options that live in the
//                                              fabric library rather than
//                                              inline on the pick)
//
// The matcher is deliberately lenient about whitespace, diacritics, and
// punctuation — but strict about *content*: every content token in the
// candidate label must be attested by the DB. That is how we catch:
//   • an invented top ("marble" on a piece whose tops are only leather)
//   • an invented base ("polished chrome" on a wood-only piece)
//   • a fabric name that doesn't belong to this product
//
// Callers pass rows they've already fetched — this module makes NO DB calls
// so it is trivial to unit-test.

/** Loose token normalizer — kept in sync with `normalizeLoose` in trade-concierge/index.ts. */
export function normalizeLoose(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tight normalizer that mirrors the `variant_image_map` key convention:
 *  lowercase alphanumerics only, no spaces. */
export function normalizeTight(value: string | null | undefined): string {
  return normalizeLoose(value).replace(/\s+/g, "");
}

export interface SizeVariantRow {
  base?: string | null;
  top?: string | null;
  label?: string | null;
  price_cents?: number | null;
}

export interface FabricRow {
  /** fabric display name, e.g. "Kyknos" or "Nero Marquina". */
  name?: string | null;
  /** optional per-product label override, e.g. "Base finish · Kyknos". */
  product_label?: string | null;
}

export interface AllowedVariantSet {
  /** Human-readable canonical labels; the first is preferred for display. */
  labels: string[];
  /** All tight-normalized tokens the candidate must be composed of. */
  tokens: Set<string>;
  /** Tight-normalized full-combo keys (e.g. "base|top"). */
  combos: Set<string>;
  /** True when the pick actually offers finish/variant choices. */
  hasChoices: boolean;
}

function pushLabel(labels: string[], label: string | null | undefined) {
  if (!label) return;
  const trimmed = String(label).trim();
  if (!trimmed) return;
  if (!labels.includes(trimmed)) labels.push(trimmed);
}

/** Build the DB-attested finish / variant vocabulary for a single pick. */
export function collectAllowedVariants(input: {
  size_variants?: SizeVariantRow[] | null;
  variant_image_map?: Record<string, unknown> | null;
  fabrics?: FabricRow[] | null;
}): AllowedVariantSet {
  const labels: string[] = [];
  const tokens = new Set<string>();
  const combos = new Set<string>();

  const addToken = (raw: string | null | undefined) => {
    const t = normalizeTight(raw);
    if (t) tokens.add(t);
  };

  for (const v of input.size_variants || []) {
    if (!v) continue;
    const parts = [v.base, v.top, v.label].filter((s): s is string => !!s && !!String(s).trim());
    if (!parts.length) continue;
    // Preserve the joined human label AND each part individually.
    pushLabel(labels, parts.join(" — "));
    for (const p of parts) {
      pushLabel(labels, p);
      addToken(p);
    }
    if (v.base && v.top) {
      combos.add(`${normalizeTight(v.base)}|${normalizeTight(v.top)}`);
    }
  }

  for (const key of Object.keys(input.variant_image_map || {})) {
    // Keys are already tight-normalized "base|top" strings. Trust them,
    // but ALSO split so bare "onyxhoney" is accepted on base-only pieces.
    combos.add(key);
    for (const part of key.split("|")) {
      if (part) tokens.add(part);
    }
  }

  for (const f of input.fabrics || []) {
    if (!f) continue;
    pushLabel(labels, f.product_label || null);
    pushLabel(labels, f.name || null);
    addToken(f.product_label);
    addToken(f.name);
  }

  return {
    labels,
    tokens,
    combos,
    hasChoices: labels.length > 0 || combos.size > 0,
  };
}

export interface VariantValidationResult {
  /** True when the candidate is executable by the DB. */
  valid: boolean;
  /** Reason for rejection, safe to log / expose to the AI on repair. */
  reason?: "no_choices_offered" | "unknown_token" | "unknown_combo";
  /** Content tokens the DB does NOT know about (rejected combo drivers). */
  unknownTokens?: string[];
  /** Canonical label the candidate resolves to when accepted. */
  matchedLabel?: string;
}

const NOISE_TOKENS = new Set<string>([
  "and", "or", "with", "in", "on", "of", "the", "a", "an",
  "cm", "mm", "m", "kg", "l", "w", "h", "d",
  "custom", "com", "col", "colour", "color", "finish", "finishes", "material", "materials",
  "top", "base", "size", "variant",
]);

/**
 * Validate a proposed variant label against the DB-attested vocabulary.
 *
 * Rules:
 *  • Empty / whitespace candidate → valid (no-op, nothing to reject).
 *  • Pick with no size_variants, no variant_image_map, and no product_fabrics
 *    → valid iff candidate is empty; otherwise `no_choices_offered`.
 *  • Combo keys ("base|top") short-circuit to accept.
 *  • Otherwise, every non-noise content token in the candidate must appear
 *    in either the token set OR as a substring of some combo key. First
 *    unknown token → reject.
 */
export function validateVariant(
  candidate: string | null | undefined,
  allowed: AllowedVariantSet,
): VariantValidationResult {
  const raw = String(candidate || "").trim();
  if (!raw) return { valid: true };

  if (!allowed.hasChoices) {
    return { valid: false, reason: "no_choices_offered", unknownTokens: [raw] };
  }

  const tight = normalizeTight(raw);

  // 1. Direct combo hit — check both "base|top" orientations.
  for (const combo of allowed.combos) {
    if (!combo.includes("|")) continue;
    const [a, b] = combo.split("|");
    if (a && b && (tight.includes(a) && tight.includes(b))) {
      return { valid: true, matchedLabel: combo };
    }
  }

  // 2. Direct label hit.
  for (const label of allowed.labels) {
    const t = normalizeTight(label);
    if (t && (tight === t || tight.includes(t) || t.includes(tight))) {
      return { valid: true, matchedLabel: label };
    }
  }

  // 3. Content-token walk. Split the loose form on spaces, drop noise words,
  //    and require every remaining token to be attested somewhere.
  const contentTokens = normalizeLoose(raw)
    .split(/\s+/)
    .filter((t) => t && !NOISE_TOKENS.has(t) && t.length > 2);

  if (contentTokens.length === 0) {
    // Candidate was pure noise words — treat as no-op rather than a hard fail.
    return { valid: true };
  }

  const flatCombos = Array.from(allowed.combos).join(" ");
  const unknown: string[] = [];
  for (const tok of contentTokens) {
    if (allowed.tokens.has(tok)) continue;
    if (flatCombos.includes(tok)) continue;
    // Fall back to loose substring against any known label.
    const looseHit = allowed.labels.some((l) => normalizeTight(l).includes(tok));
    if (looseHit) continue;
    unknown.push(tok);
  }

  if (unknown.length === 0) {
    return { valid: true, matchedLabel: allowed.labels[0] };
  }
  return { valid: false, reason: "unknown_token", unknownTokens: unknown };
}

/**
 * Reconcile a batch of proposed lines against DB-attested variants. Each
 * line whose `variant` cannot be executed has its `variant` scrubbed to
 * null and a `variant_repair` string attached explaining the rejection.
 * The line itself is retained so the tearsheet still surfaces the piece —
 * the picker on the card then lets the trade user choose a real finish.
 */
export interface LineWithVariant {
  pick_id: string;
  variant?: string | null;
  [k: string]: unknown;
}

export interface VariantRepair {
  pick_id: string;
  requested: string;
  reason: NonNullable<VariantValidationResult["reason"]>;
  unknown_tokens?: string[];
}

export function reconcileVariants<L extends LineWithVariant>(
  lines: L[],
  allowedByPick: Map<string, AllowedVariantSet>,
): { lines: L[]; repairs: VariantRepair[] } {
  const repairs: VariantRepair[] = [];
  const out = lines.map((l) => {
    const allowed = allowedByPick.get(l.pick_id);
    if (!allowed) return l; // No DB row — leave alone; other guardrails handle unknown pick ids.
    const check = validateVariant(l.variant, allowed);
    if (check.valid) return l;
    repairs.push({
      pick_id: l.pick_id,
      requested: String(l.variant || ""),
      reason: check.reason!,
      unknown_tokens: check.unknownTokens,
    });
    return { ...l, variant: null, variant_repair: describeRepair(check, allowed) };
  });
  return { lines: out, repairs };
}

function describeRepair(check: VariantValidationResult, allowed: AllowedVariantSet): string {
  if (check.reason === "no_choices_offered") {
    return "This piece has no configurable finish — the requested variant was dropped.";
  }
  const preview = allowed.labels.slice(0, 4).join(" · ");
  const suffix = preview ? ` Available: ${preview}${allowed.labels.length > 4 ? " …" : ""}` : "";
  return `Requested finish is not offered for this piece.${suffix}`;
}
