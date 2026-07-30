// Hard-constraint filtering for AI catalog recommenders.
// Pre-filters the DB (materials + tags text) so the AI never sees candidates
// that violate a constraint. Complements the softer relevance ranker.

export interface HardConstraints {
  materials?: string[]; // e.g. ["oak", "brass"]
  colors?: string[];    // e.g. ["forest green", "black"]
  categories?: string[]; // canonical category slugs to intersect
  excludeBrands?: string[];
  /**
   * How the material + color buckets combine.
   * - "all" (default): row must match a material token AND a color token.
   * - "any": row must match at least ONE token from the merged pool. Used for
   *   accent briefs like "oak, brass, ivory", where the designer is listing
   *   an accent palette, not three simultaneous requirements. AND-ing those
   *   buckets wiped out whole ateliers (e.g. Ecart / Jean-Michel Frank oak
   *   pieces were rejected purely for lacking the word "ivory").
   */
  matchMode?: "all" | "any";
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
  return (v || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeForRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTokens(haystack: string, dictionary: string[]): string[] {
  const norm = normalize(haystack);
  const hits = new Set<string>();
  // Prefer longer phrases first so "forest green" wins over "green".
  const sorted = [...dictionary].sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    // Word-boundary match only. A plain substring match would catch "brown"
    // inside "brownstone", "stone" inside "brownstone" / "limestone", "oak"
    // inside "oakland", etc. — leading to false-positive hard filters that
    // wipe out the curated shortlist. Compound tokens like "forest green"
    // use \s+ between words so extra whitespace still matches.
    const parts = token.split(/\s+/).map(escapeForRegex);
    const re = new RegExp(`\\b${parts.join("\\s+")}\\b`, "i");
    if (re.test(norm)) hits.add(token);
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

  const uniqueMaterials = [...new Set(materials)];
  const uniqueColors = [...new Set(colors)];
  // Three or more distinct palette/material tokens reads as an ACCENT LIST
  // ("oak, brass, ivory"), not three simultaneous requirements — match any.
  const distinctTokens = new Set([...uniqueMaterials, ...uniqueColors]).size;
  const matchMode: "all" | "any" =
    explicit?.matchMode ?? (distinctTokens >= 3 ? "any" : "all");

  return {
    materials: uniqueMaterials,
    colors: uniqueColors,
    categories: explicit?.categories?.map((c) => c.toLowerCase().trim()).filter(Boolean),
    excludeBrands: explicit?.excludeBrands?.map((b) => b.toLowerCase().trim()).filter(Boolean),
    matchMode,
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

function expandConstraintTokens(tokens: string[]): string[] {
  const dictionary = new Set([...COLOR_KEYWORDS, ...MATERIAL_KEYWORDS].map(normalize));
  const expanded = new Set<string>();

  for (const raw of tokens || []) {
    const original = String(raw || "").toLowerCase().trim();
    const normalized = normalize(original);
    if (!original && !normalized) continue;

    if (original) expanded.add(original);
    if (normalized) expanded.add(normalized);

    // Multi-word brief tokens often arrive as "warm oak", "patinated brass",
    // or "ivory bouclé". Search the material/color nouns as well; otherwise a
    // literal phrase pre-filter can wipe valid rows whose metadata says simply
    // "oak" / "brass" / "bouclé".
    for (const part of normalized.split(/\s+/)) {
      if (dictionary.has(part)) expanded.add(part);
    }
  }

  if (expanded.has("boucle")) expanded.add("bouclé");
  if (expanded.has("bouclé")) expanded.add("boucle");
  if (expanded.has("boucle") || expanded.has("bouclé") || expanded.has("ivory")) {
    expanded.add("fabric");
    expanded.add("textile");
    expanded.add("upholstery");
    expanded.add("com fabric");
    expanded.add("fabric cat");
  }

  return [...expanded].filter(Boolean);
}

function expandCategoryConstraintTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const raw of tokens || []) {
    const normalized = normalize(String(raw || ""));
    if (!normalized) continue;
    expanded.add(normalized);
    if (normalized === "seating") {
      ["seating", "sectional", "sofa", "settee", "loveseat", "chair", "armchair", "lounge chair", "dining chair", "bench", "stool", "ottoman", "pouf", "banquette", "daybed", "chaise"].forEach((t) => expanded.add(t));
    } else if (normalized === "table" || normalized === "tables" || normalized === "dining table") {
      ["tables", "dining table", "coffee table", "side table", "console", "desk", "table"].forEach((t) => expanded.add(t));
    } else if (normalized === "lighting") {
      ["lighting", "floor lamp", "floor light", "table lamp", "table light", "pendant", "ceiling light", "chandelier", "sconce", "wall light", "lantern", "lamp"].forEach((t) => expanded.add(t));
    } else if (normalized === "storage") {
      ["storage", "cabinet", "sideboard", "credenza", "shelving", "bookcase", "dresser", "chest", "armoire"].forEach((t) => expanded.add(t));
    } else if (normalized === "bedroom furniture") {
      ["bedroom furniture", "bed", "headboard", "nightstand", "bedside"].forEach((t) => expanded.add(t));
    } else if (normalized === "rugs") {
      ["rugs", "rug", "carpet", "kilim", "dhurrie"].forEach((t) => expanded.add(t));
    } else if (normalized === "decor" || normalized === "décor") {
      ["decor", "décor", "vase", "sculpture", "object", "screen", "mirror", "art"].forEach((t) => expanded.add(t));
    }
  }
  return [...expanded].filter(Boolean);
}

function categoryTokenMatches(rowText: string, token: string): boolean {
  if (!token) return false;
  if (rowText.includes(token)) return true;
  if (token === "seating") return /\b(sectional|sofa|settee|loveseat|chair|armchair|bench|stool|ottoman|pouf|banquette|daybed|chaise)\b/.test(rowText);
  if (token === "table" || token === "tables" || token === "dining table") {
    return /\b(dining table|coffee table|side table|console|desk|tables?)\b/.test(rowText) && !/\b(table lamp|table light)\b/.test(rowText);
  }
  if (token === "lighting") return /\b(floor lamp|floor light|table lamp|table light|pendant|ceiling light|chandelier|sconce|wall light|lantern|lighting|lamp)\b/.test(rowText);
  if (token === "storage") return /\b(cabinet|sideboard|credenza|shelving|bookcase|dresser|chest|armoire|storage)\b/.test(rowText);
  if (token === "bedroom furniture") return /\b(bed|headboard|nightstand|bedside|bedroom)\b/.test(rowText);
  if (token === "rugs") return /\b(rug|carpet|kilim|dhurrie)\b/.test(rowText);
  if (token === "decor" || token === "décor") return /\b(vase|sculpture|object|screen|mirror|art|decor)\b/.test(rowText);
  return false;
}

/**
 * Build a PostgREST `.or(...)` expression that requires the row to match
 * AT LEAST ONE token across the given text columns via ILIKE.
 * Returns null when there are no tokens (caller should skip .or()).
 */
export function buildIlikeOr(tokens: string[], columns: string[]): string | null {
  const safe = expandConstraintTokens(tokens).map(escapeIlike).filter(Boolean);
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
  if (constraints.matchMode === "any") {
    // Accent-list brief: one merged OR pool instead of two AND groups.
    const pool = buildIlikeOr(
      [...(constraints.materials || []), ...(constraints.colors || [])],
      columns.text,
    );
    if (pool) q = q.or(pool);
  } else {
    const mat = buildIlikeOr(constraints.materials || [], columns.text);
    if (mat) q = q.or(mat);
    const col = buildIlikeOr(constraints.colors || [], columns.text);
    if (col) q = q.or(col);
  }
  if (constraints.categories?.length && columns.category) {
    const categoryColumns = Array.from(new Set([columns.category, ...columns.text]));
    const cat = buildIlikeOr(expandCategoryConstraintTokens(constraints.categories), categoryColumns);
    if (cat) q = q.or(cat);
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
  columns: { text?: string[]; arrayText?: string[]; brand?: string; category?: string } = {},
): R[] {
  const textCols = columns.text ?? [
    "title", "product_name", "materials", "materials_description",
    "description", "meta_description", "variant_placeholder",
    "category", "subcategory",
  ];
  // Array-of-text columns (e.g. tags, available_finishes, fabric_options) —
  // joined into the haystack so palette / material tokens still match when
  // `materials` is null but the finish lives in an upholstery variant list.
  const arrayTextCols = columns.arrayText ?? [
    "tags", "available_finishes", "fabric_options",
  ];
  const brandCol = columns.brand ?? "brand_name";
  const categoryCol = columns.category ?? "category";

  const matTokens = expandConstraintTokens(constraints.materials || []).map(normalize).filter(Boolean);
  const colorTokens = expandConstraintTokens(constraints.colors || []).map(normalize).filter(Boolean);
  const cats = expandCategoryConstraintTokens(constraints.categories || []).map(normalize).filter(Boolean);
  const excl = (constraints.excludeBrands || []).map((b) => b.toLowerCase()).filter(Boolean);

  const rowText = (r: R): string => {
    const scalar = textCols.map((c) => String(r[c] ?? "")).join(" ");
    const arr = arrayTextCols
      .map((c) => {
        const v = r[c];
        return Array.isArray(v) ? v.join(" ") : "";
      })
      .join(" ");
    return normalize(`${scalar} ${arr}`);
  };

  return rows.filter((r) => {
    const hay = rowText(r);
    if (matTokens.length && !matTokens.some((t) => hay.includes(t))) return false;
    if (colorTokens.length && !colorTokens.some((t) => hay.includes(t))) return false;
    if (cats.length) {
      const rc = normalize(`${String(r[categoryCol] ?? "")} ${hay}`);
      if (!cats.some((c) => categoryTokenMatches(rc, c))) return false;
    }
    if (excl.length) {
      const rb = String(r[brandCol] ?? "").toLowerCase();
      if (excl.some((b) => rb.includes(b))) return false;
    }
    return true;
  });
}

