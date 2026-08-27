// Anti-hallucination guardrail for the AI Curatorial Guide.
//
// The curatorial system prompt forces every Designer Name and Product Name to be
// bolded (**like this**). That gives us a cheap, deterministic audit surface:
// extract every bolded token from the raw markdown, cross-reference it against the
// verified name cache (313 designers / 689 curator picks / 1,002 trade products),
// and refuse to render anything that is not in Postgres.
//
// On a violation we either
//   a) silently re-run the Flash model with a stricter "do not invent profiles"
//      system variance, or
//   b) strip the offending recommendation lines,
// and log the interception to public.guardrail_logs for auditing.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/** Bolded names are the guardrail surface. */
const BOLD_RE = /\*\*(.+?)\*\*/g;

/** Cache the verified-name set in module scope; refresh at most this often. */
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface VerifiedNameSet {
  /** Normalized -> original display name. */
  names: Map<string, string>;
  loadedAt: number;
  counts: { designers: number; products: number; picks: number };
}

let nameCache: VerifiedNameSet | null = null;
let inflight: Promise<VerifiedNameSet | null> | null = null;

export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function addName(map: Map<string, string>, value: unknown) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed.length < 2) return;
  const key = normalizeName(trimmed);
  if (!key) return;
  if (!map.has(key)) map.set(key, trimmed);
}

/** Load (and memoize) every verified designer / brand / product name from Postgres. */
export async function loadVerifiedNames(force = false): Promise<VerifiedNameSet | null> {
  if (!force && nameCache && Date.now() - nameCache.loadedAt < CACHE_TTL_MS) return nameCache;
  if (inflight) return inflight;

  inflight = (async () => {
    const sb = serviceClient();
    if (!sb) return null;
    try {
      const [designers, products, picks] = await Promise.all([
        sb.from("designers").select("name, founder, slug"),
        sb.from("trade_products").select("product_name, brand_name, designer_name"),
        sb.from("designer_curator_picks").select("product_name, brand_name, designer_name"),
      ]);

      const names = new Map<string, string>();
      for (const d of designers.data ?? []) {
        addName(names, (d as Record<string, unknown>).name);
        addName(names, (d as Record<string, unknown>).founder);
      }
      for (const p of products.data ?? []) {
        const row = p as Record<string, unknown>;
        addName(names, row.product_name);
        addName(names, row.brand_name);
        addName(names, row.designer_name);
      }
      for (const p of picks.data ?? []) {
        const row = p as Record<string, unknown>;
        addName(names, row.product_name);
        addName(names, row.brand_name);
        addName(names, row.designer_name);
      }

      nameCache = {
        names,
        loadedAt: Date.now(),
        counts: {
          designers: designers.data?.length ?? 0,
          products: products.data?.length ?? 0,
          picks: picks.data?.length ?? 0,
        },
      };
      return nameCache;
    } catch (e) {
      console.error("guardrail: loadVerifiedNames failed", (e as Error).message);
      return nameCache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Non-name bold usage the model legitimately produces — never treated as a hallucination. */
const BOLD_ALLOWLIST = new Set(
  [
    "price on request",
    "price upon request",
    "note",
    "materials",
    "material",
    "finish",
    "finishes",
    "dimensions",
    "designer",
    "designers",
    "product",
    "products",
    "brand",
    "lead time",
    "category",
    "availability",
    "why it fits",
    "maison affluency",
  ].map(normalizeName),
);

function isAllowedBold(candidate: string): boolean {
  const key = normalizeName(candidate);
  if (!key) return true;
  if (BOLD_ALLOWLIST.has(key)) return true;
  // Pure numbers / measurements / prices are not names.
  if (!/[a-z]/.test(key)) return true;
  return false;
}

/**
 * A bolded token counts as verified when it matches a DB name exactly, or when it
 * is a contiguous subset/superset of one (e.g. "Clam Chair" inside
 * "Clam Chair and Stool, 1944", or "Pierre Jeanneret" inside a longer product line).
 */
function isVerified(candidate: string, names: Map<string, string>): boolean {
  const key = normalizeName(candidate);
  if (!key) return true;
  if (names.has(key)) return true;
  for (const known of names.keys()) {
    if (known.includes(key) || key.includes(known)) return true;
  }
  return false;
}

export interface GuardrailContextName {
  product_name?: string | null;
  brand_name?: string | null;
  designer_name?: string | null;
}

export interface ValidateAIResponseResult {
  valid: boolean;
  /** Bolded names present in Postgres (or in the retrieved context). */
  validNames: string[];
  /** Bolded names with no match — the hallucinations. */
  invalidNames: string[];
  /** The response with hallucinated recommendations removed. */
  sanitized: string;
}

/**
 * Client-side guardrail: extract every **bolded** name from the raw LLM markdown and
 * cross-reference it against the verified dataset. Returns the offending names plus a
 * sanitized copy with the invalid recommendations stripped.
 */
export async function validateAIResponse(
  raw: string,
  opts: { contextItems?: GuardrailContextName[]; names?: Map<string, string> } = {},
): Promise<ValidateAIResponseResult> {
  const text = raw ?? "";
  const set = opts.names ?? (await loadVerifiedNames())?.names ?? new Map<string, string>();

  // Names retrieved for this turn are always trusted (they came straight from Postgres).
  const names = new Map(set);
  for (const item of opts.contextItems ?? []) {
    addName(names, item.product_name);
    addName(names, item.brand_name);
    addName(names, item.designer_name);
  }

  const validNames: string[] = [];
  const invalidNames: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(BOLD_RE)) {
    const candidate = match[1].replace(/[*_`]/g, "").trim();
    const key = normalizeName(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (isAllowedBold(candidate)) continue;
    if (isVerified(candidate, names)) validNames.push(candidate);
    else invalidNames.push(candidate);
  }

  // If the name cache is unavailable, fail open rather than blanking the answer.
  if (!names.size) {
    return { valid: true, validNames: [], invalidNames: [], sanitized: text };
  }

  const sanitized = invalidNames.length ? stripInvalidLines(text, invalidNames) : text;

  return {
    valid: invalidNames.length === 0,
    validNames,
    invalidNames,
    sanitized,
  };
}

/** Drop any bullet / line that recommends an unverified name. */
export function stripInvalidLines(text: string, invalidNames: string[]): string {
  const keys = invalidNames.map(normalizeName).filter(Boolean);
  const kept = text
    .split("\n")
    .filter((line) => {
      const norm = normalizeName(line);
      return !keys.some((k) => norm.includes(k));
    });
  const out = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return out.length
    ? out
    : "No pieces in the current Maison Affluency curation match that brief precisely. Tell me the material, silhouette or room and I will search the collection again.";
}

export interface GuardrailLogEntry {
  userId?: string | null;
  feature?: string;
  model?: string | null;
  tier?: string | null;
  query?: string | null;
  invalidNames: string[];
  validNames?: string[];
  action: "stripped" | "regenerated" | "regeneration_failed";
  rawAnswer?: string | null;
  finalAnswer?: string | null;
}

/** Fire-and-forget audit write to public.guardrail_logs. */
export function logGuardrailViolation(entry: GuardrailLogEntry): void {
  const sb = serviceClient();
  if (!sb) return;
  void sb
    .from("guardrail_logs")
    .insert({
      user_id: entry.userId ?? null,
      feature: entry.feature ?? "curatorial-query",
      model: entry.model ?? null,
      tier: entry.tier ?? null,
      query: entry.query ?? null,
      invalid_names: entry.invalidNames,
      valid_names: entry.validNames ?? [],
      action: entry.action,
      raw_answer: entry.rawAnswer?.slice(0, 8000) ?? null,
      final_answer: entry.finalAnswer?.slice(0, 8000) ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("guardrail log failed", error.message);
    });
}

/** Stricter system-prompt variance used for the silent Flash retry. */
export const STRICT_NO_INVENT_SUFFIX = `
GUARDRAIL RETRY — your previous answer referenced names that do not exist in our database.
DO NOT INVENT PROFILES. You may only name designers, brands and products that appear verbatim
inside the [Database Context] block. Never bold a name that is not in that block. If the block
does not contain a suitable piece, say so plainly and stop — do not substitute an outside name.`;
