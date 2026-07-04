// Deterministic lead-time constraint extraction + row filter for the concierge.
//
// Handles user phrasing like:
//   "delivered under 8 weeks"
//   "must ship within 6 weeks"
//   "lead time no more than 3 months"
//   "in stock only"
//   "ready within 4 weeks"
//   "at least 12 weeks lead time" (min floor — rare, but supported)
//
// Rows may carry a free-text `lead_time` (e.g. "8-10 weeks", "6 weeks", "3 months",
// "in stock", "made to order"). When a row's lead_time is missing/unknown we try
// a fallback via a brand-level default table (brand_lead_times.default_lead_weeks_max).
//
// All values are normalized to WEEKS before comparison.
// A row survives when: parsedMinWeeks >= constraints.minWeeks (if set)
//                  AND parsedMaxWeeks <= constraints.maxWeeks (if set).
// If a row cannot be parsed AND has no brand fallback, it is dropped in strict mode
// unless the safety valve triggers (see filterRowsByLeadTimeConstraints).

export type LeadTimeConstraints = {
  maxWeeks?: number;
  minWeeks?: number;
  inStockOnly?: boolean;
};

export type ParsedLeadTime = {
  minWeeks: number;
  maxWeeks: number;
  isInStock: boolean;
} | null;

/** Parse a free-text lead-time string into a min/max week range. */
export function parseLeadTimeWeeks(input: string | null | undefined): ParsedLeadTime {
  if (!input) return null;
  const s = String(input).toLowerCase().trim();
  if (!s) return null;
  // In-stock synonyms → 0 weeks
  if (/(^|\b)(in[\s_-]?stock|available now|ready to ship|ships? now|immediate)\b/.test(s)) {
    return { minWeeks: 0, maxWeeks: 0, isInStock: true };
  }
  // Numeric range: "8-10 weeks", "6 to 8 wks", "2–3 months"
  const rangeRe = /(\d+(?:\.\d+)?)\s*(?:[–\-]|to)\s*(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/;
  const rangeMatch = s.match(rangeRe);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    const unit = rangeMatch[3];
    const mult = unit.startsWith("mo") ? 4 : 1;
    return { minWeeks: lo * mult, maxWeeks: hi * mult, isInStock: false };
  }
  // Single value: "8 weeks", "3 months", "6wk"
  const singleRe = /(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/;
  const singleMatch = s.match(singleRe);
  if (singleMatch) {
    const v = parseFloat(singleMatch[1]);
    const mult = singleMatch[2].startsWith("mo") ? 4 : 1;
    const w = v * mult;
    return { minWeeks: w, maxWeeks: w, isInStock: false };
  }
  return null;
}

/**
 * Extract a lead-time ceiling / floor from user free text.
 * Returns undefined-only keys when nothing is stated.
 */
export function inferLeadTimeConstraints(text: string | null | undefined): LeadTimeConstraints | null {
  if (!text) return null;
  const s = String(text).toLowerCase();
  const out: LeadTimeConstraints = {};

  // In-stock only
  if (/\b(in[\s_-]?stock only|only in[\s_-]?stock|stock only|available now|ready to ship|ships? immediately|immediate delivery|need it now|need this now)\b/.test(s)) {
    out.inStockOnly = true;
    out.maxWeeks = 0;
  }

  // Ceilings: "under 8 weeks", "less than 8 weeks", "no more than 10 weeks",
  // "max 6 weeks", "within 8 weeks", "delivered in 8 weeks or less",
  // "up to 12 weeks", "≤ 8 weeks", "under 3 months"
  const ceilingPatterns: RegExp[] = [
    /(?:under|less than|no more than|no longer than|max(?:imum)?(?: of)?|within|inside|ships? within|delivered in|delivery in|delivered within|delivery within|by|up to|not more than|not longer than|≤|<=?)\s*(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/g,
    /(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\s*(?:or less|or under|or sooner|tops?|maximum|max|ceiling)\b/g,
  ];
  for (const re of ceilingPatterns) {
    for (const m of s.matchAll(re)) {
      const v = parseFloat(m[1]);
      const mult = m[2].startsWith("mo") ? 4 : 1;
      const weeks = v * mult;
      if (Number.isFinite(weeks) && weeks > 0) {
        out.maxWeeks = out.maxWeeks == null ? weeks : Math.min(out.maxWeeks, weeks);
      }
    }
  }

  // Floors: "at least 12 weeks", "minimum 8 weeks", "≥ 6 weeks", "no less than 4 weeks"
  const floorPatterns: RegExp[] = [
    /(?:at least|no less than|min(?:imum)?(?: of)?|≥|>=?)\s*(\d+(?:\.\d+)?)\s*(week|wk|wks|weeks|month|months|mo|mos)\b/g,
  ];
  for (const re of floorPatterns) {
    for (const m of s.matchAll(re)) {
      const v = parseFloat(m[1]);
      const mult = m[2].startsWith("mo") ? 4 : 1;
      const weeks = v * mult;
      if (Number.isFinite(weeks) && weeks > 0) {
        out.minWeeks = out.minWeeks == null ? weeks : Math.max(out.minWeeks, weeks);
      }
    }
  }

  if (out.maxWeeks == null && out.minWeeks == null && !out.inStockOnly) return null;
  return out;
}

export type BrandLeadTimeEntry = {
  minWeeks: number | null;
  maxWeeks: number | null;
  stockStatus: string | null;
};

/** Normalize a brand/designer key for lookup. */
function normalizeBrandKey(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildBrandLeadTimeIndex(
  rows: Array<{ brand_name: string; default_lead_weeks_min?: number | null; default_lead_weeks_max?: number | null; default_stock_status?: string | null }>,
): Map<string, BrandLeadTimeEntry> {
  const idx = new Map<string, BrandLeadTimeEntry>();
  for (const r of rows || []) {
    const key = normalizeBrandKey(r?.brand_name);
    if (!key) continue;
    idx.set(key, {
      minWeeks: typeof r.default_lead_weeks_min === "number" ? r.default_lead_weeks_min : null,
      maxWeeks: typeof r.default_lead_weeks_max === "number" ? r.default_lead_weeks_max : null,
      stockStatus: r.default_stock_status ?? null,
    });
  }
  return idx;
}

/** Resolve a row's effective lead-time from its own fields, falling back to brand defaults. */
export function resolveRowLeadTime(
  row: any,
  brandIndex?: Map<string, BrandLeadTimeEntry> | null,
): ParsedLeadTime {
  const direct = parseLeadTimeWeeks(row?.lead_time);
  if (direct) return direct;
  // stock_status → 0/0 if it explicitly says in-stock
  const stock = String(row?.stock_status || "").toLowerCase();
  if (/(in[\s_-]?stock|available|ready)/.test(stock)) {
    return { minWeeks: 0, maxWeeks: 0, isInStock: true };
  }
  if (!brandIndex || brandIndex.size === 0) return null;
  const candidates = [row?.brand_name, row?.designer, row?.brand]
    .map(normalizeBrandKey)
    .filter(Boolean);
  for (const key of candidates) {
    const hit = brandIndex.get(key);
    if (!hit) continue;
    const lo = hit.minWeeks ?? hit.maxWeeks;
    const hi = hit.maxWeeks ?? hit.minWeeks;
    if (lo == null || hi == null) continue;
    return { minWeeks: lo, maxWeeks: hi, isInStock: false };
  }
  return null;
}

export type LeadTimeFilterResult<T> = {
  kept: T[];
  strictKept: T[];
  dropped: number;
  unknownDropped: number;
  fellBack: boolean;
};

/**
 * Strict-mode filter. Rows survive when their parsed lead-time range is compatible
 * with the constraints. Rows with unresolvable lead-time (no direct string, no brand
 * fallback, no in-stock marker) are dropped in strict mode. Safety valve: if fewer
 * than 2 survive, we return the strict set anyway (may be empty) and set fellBack.
 * The caller decides whether to broaden.
 */
export function filterRowsByLeadTimeConstraints<T extends Record<string, any>>(
  rows: T[],
  constraints: LeadTimeConstraints,
  brandIndex?: Map<string, BrandLeadTimeEntry> | null,
  opts: { minSurvivors?: number } = {},
): LeadTimeFilterResult<T> {
  const minSurvivors = opts.minSurvivors ?? 2;
  const strictKept: T[] = [];
  let unknownDropped = 0;
  for (const r of rows) {
    const parsed = resolveRowLeadTime(r, brandIndex);
    if (!parsed) {
      unknownDropped += 1;
      continue;
    }
    if (constraints.inStockOnly && !parsed.isInStock) continue;
    if (constraints.maxWeeks != null && parsed.minWeeks > constraints.maxWeeks) continue;
    if (constraints.minWeeks != null && parsed.maxWeeks < constraints.minWeeks) continue;
    strictKept.push(r);
  }
  const dropped = rows.length - strictKept.length;
  if (strictKept.length >= minSurvivors) {
    return { kept: strictKept, strictKept, dropped, unknownDropped, fellBack: false };
  }
  return { kept: strictKept, strictKept, dropped, unknownDropped, fellBack: true };
}
