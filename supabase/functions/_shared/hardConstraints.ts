// Hard-constraint filtering for AI catalog recommenders.
// Pre-filters the DB (materials + tags text) so the AI never sees candidates
// that violate a constraint. Complements the softer relevance ranker.

export interface HardConstraints {
  materials?: string[]; // e.g. ["oak", "brass"]
  colors?: string[];    // e.g. ["forest green", "black"]
  categories?: string[]; // canonical category slugs to intersect
  excludeBrands?: string[];
}

export const COLOR_KEYWORDS: string[] = [
  "black", "white", "ivory", "cream", "beige", "taupe", "sand", "camel",
  "brown", "chocolate", "walnut", "cognac", "tan",
  "grey", "gray", "charcoal", "graphite", "smoke",
  "green", "forest green", "olive", "sage", "emerald", "moss",
  "blue", "navy", "cobalt", "indigo", "teal",
  "red", "burgundy", "oxblood", "rust", "terracotta",
  "pink", "blush", "rose",
  "yellow", "ochre", "mustard",
  "gold", "brass", "bronze", "copper", "silver", "chrome", "nickel",
];

export const MATERIAL_KEYWORDS: string[] = [
  "walnut", "oak", "ash", "wood", "timber",
  "stone", "marble", "travertine", "limestone", "granite", "alabaster",
  "glass", "brass", "bronze", "copper", "steel", "metal",
  "linen", "leather", "boucle", "wool", "velvet", "silk", "fabric", "textile",
  "ceramic", "plaster", "concrete", "paper", "parchment",
  "rattan", "cane", "lacquer", "shagreen", "horsehair",
];

function normalize(v: string | null | undefined): string {
  return (v || "").toLowerCase().replace(/[^a-z0-9\s&/-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractTokens(haystack: string, dictionary: string[]): string[] {
  const norm = ` ${normalize(haystack)} `;
  const hits = new Set<string>();
  // Prefer longer phrases first so "forest green" wins over "green".
  const sorted = [...dictionary].sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    if (norm.includes(` ${token} `) || norm.includes(token)) hits.add(token);
  }
  return [...hits];
}

export interface BoardItemForConstraints {
  title?: string;
  materials?: string;
  tags?: string[];
  category?: string;
}

/**
 * Merge caller-supplied constraints with tokens auto-derived from the board.
 * Explicit constraints always win; derived tokens only fill gaps.
 */
export function deriveHardConstraints(
  boardItems: BoardItemForConstraints[],
  explicit?: HardConstraints,
): HardConstraints {
  const haystack = boardItems
    .map((i) => [i.title, i.materials, i.category, (i.tags || []).join(" ")].filter(Boolean).join(" "))
    .join(" ");

  const derivedColors = extractTokens(haystack, COLOR_KEYWORDS);
  const derivedMaterials = extractTokens(haystack, MATERIAL_KEYWORDS);

  const materials = (explicit?.materials?.length ? explicit.materials : derivedMaterials)
    .map((m) => m.toLowerCase().trim())
    .filter(Boolean);
  const colors = (explicit?.colors?.length ? explicit.colors : derivedColors)
    .map((c) => c.toLowerCase().trim())
    .filter(Boolean);

  return {
    materials: [...new Set(materials)],
    colors: [...new Set(colors)],
    categories: explicit?.categories?.map((c) => c.toLowerCase().trim()).filter(Boolean),
    excludeBrands: explicit?.excludeBrands?.map((b) => b.toLowerCase().trim()).filter(Boolean),
  };
}

/**
 * Escape a token for use inside a PostgREST `or` filter value.
 * PostgREST separates filters with commas and wraps parenthesised groups;
 * a comma or parenthesis in the value would break the parser.
 */
function escapeIlike(token: string): string {
  return token.replace(/[,()*]/g, " ").trim();
}

/**
 * Build a PostgREST `.or(...)` expression that requires the row to match
 * AT LEAST ONE token across the given text columns via ILIKE.
 * Returns null when there are no tokens (caller should skip .or()).
 */
export function buildIlikeOr(tokens: string[], columns: string[]): string | null {
  const safe = tokens.map(escapeIlike).filter(Boolean);
  if (safe.length === 0 || columns.length === 0) return null;
  const parts: string[] = [];
  for (const col of columns) {
    for (const tok of safe) {
      parts.push(`${col}.ilike.%${tok}%`);
    }
  }
  return parts.join(",");
}

/**
 * Apply hard constraints to a Supabase query builder.
 * Uses ILIKE OR groups so a row satisfies a constraint bucket if ANY listed
 * column contains ANY of the tokens. Materials and colors are separate AND groups.
 */
export function applyHardConstraints<Q extends {
  or: (expr: string) => Q;
  not: (col: string, op: string, val: unknown) => Q;
  in: (col: string, vals: unknown[]) => Q;
}>(
  query: Q,
  constraints: HardConstraints,
  columns: { text: string[]; brand?: string; category?: string },
): Q {
  let q = query;
  const mat = buildIlikeOr(constraints.materials || [], columns.text);
  if (mat) q = q.or(mat);
  const col = buildIlikeOr(constraints.colors || [], columns.text);
  if (col) q = q.or(col);
  if (constraints.categories?.length && columns.category) {
    q = q.in(columns.category, constraints.categories);
  }
  if (constraints.excludeBrands?.length && columns.brand) {
    for (const brand of constraints.excludeBrands) {
      q = q.not(columns.brand, "ilike", `%${brand}%`);
    }
  }
  return q;
}

/**
 * In-memory equivalent of applyHardConstraints, used to post-filter rows
 * returned by pgvector RPCs (which can't accept SQL text filters).
 * Row must match at least one material token AND one color token AND (if
 * given) fall inside `categories` AND not match any excludeBrands.
 * Empty buckets are treated as pass-through.
 */
export function filterRowsByHardConstraints<
  R extends Record<string, unknown>,
>(
  rows: R[],
  constraints: HardConstraints,
  columns: { text?: string[]; brand?: string; category?: string } = {},
): R[] {
  const textCols = columns.text ?? [
    "title", "product_name", "materials", "category", "subcategory",
  ];
  const brandCol = columns.brand ?? "brand_name";
  const categoryCol = columns.category ?? "category";

  const matTokens = (constraints.materials || []).map((m) => m.toLowerCase()).filter(Boolean);
  const colorTokens = (constraints.colors || []).map((c) => c.toLowerCase()).filter(Boolean);
  const cats = (constraints.categories || []).map((c) => c.toLowerCase()).filter(Boolean);
  const excl = (constraints.excludeBrands || []).map((b) => b.toLowerCase()).filter(Boolean);

  const rowText = (r: R): string =>
    textCols.map((c) => String(r[c] ?? "")).join(" ").toLowerCase();

  return rows.filter((r) => {
    const hay = rowText(r);
    if (matTokens.length && !matTokens.some((t) => hay.includes(t))) return false;
    if (colorTokens.length && !colorTokens.some((t) => hay.includes(t))) return false;
    if (cats.length) {
      const rc = String(r[categoryCol] ?? "").toLowerCase();
      if (!cats.some((c) => rc.includes(c))) return false;
    }
    if (excl.length) {
      const rb = String(r[brandCol] ?? "").toLowerCase();
      if (excl.some((b) => rb.includes(b))) return false;
    }
    return true;
  });
}

