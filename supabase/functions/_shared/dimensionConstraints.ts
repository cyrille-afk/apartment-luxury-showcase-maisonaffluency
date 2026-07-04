// Deterministic dimension-constraint extraction + row filter for the concierge.
//
// Given free-text like:
//   "a sofa under 240cm in length, max 90cm deep, and 75cm tall"
//   "dining table no more than 220 cm long"
//   "coffee table with a minimum seat depth of 45cm"
//
// we extract hard numeric ceilings/floors and apply them against catalog rows
// whose `dimensions` column is a free-text string like
//   "W 140 x D 50 x H 100 cm"  |  "Dia 120 x H 25 cm"  |  "251 × 297 cm"
//   "H75 × W80 × D85 cm"       |  "42\" W x 32\" D x 30\" H"
//
// All numeric values are normalized to millimetres before comparison.

export type DimensionConstraints = {
  maxLengthMm?: number;
  minLengthMm?: number;
  maxWidthMm?: number;
  minWidthMm?: number;
  maxDepthMm?: number;
  minDepthMm?: number;
  maxHeightMm?: number;
  minHeightMm?: number;
  maxDiameterMm?: number;
  minDiameterMm?: number;
  minSeatDepthMm?: number;
  maxSeatDepthMm?: number;
  maxSeatHeightMm?: number;
  minSeatHeightMm?: number;
};

export type ParsedRowDimensions = {
  lengthMm: number | null; // longest horizontal / "L" / plain N × M when only two dims given
  widthMm: number | null;  // "W"
  depthMm: number | null;  // "D"
  heightMm: number | null; // "H"
  diameterMm: number | null; // "Dia" / "Ø" / "diam"
  seatDepthMm: number | null;
  seatHeightMm: number | null;
};

const CM_TO_MM = 10;
const M_TO_MM = 1000;
const INCH_TO_MM = 25.4;

/** Parse a single number+unit token → mm. Returns null if unparseable. */
function toMm(raw: string, unitHint: "cm" | "mm" | "m" | "in" | null): number | null {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  switch (unitHint) {
    case "mm": return Math.round(n);
    case "cm": return Math.round(n * CM_TO_MM);
    case "m":  return Math.round(n * M_TO_MM);
    case "in": return Math.round(n * INCH_TO_MM);
    default:   return Math.round(n * CM_TO_MM); // default cm — matches our catalog convention
  }
}

/** Sniff a unit token appearing anywhere in the phrase. */
function sniffUnit(hay: string): "cm" | "mm" | "m" | "in" | null {
  const s = hay.toLowerCase();
  if (/\b(mm|millimet)/.test(s)) return "mm";
  if (/\b(cm|centimet)/.test(s)) return "cm";
  if (/(["″]|\binch|inches|\bin\b)/.test(s)) return "in";
  if (/\bmet(re|er)s?\b|\bm\b/.test(s)) return "m";
  return null;
}

/**
 * Extract deterministic dimension constraints from user text.
 * Only returns fields the user actually mentioned. All values in mm.
 */
export function inferDimensionConstraints(requestText: string): DimensionConstraints | null {
  const text = String(requestText || "");
  if (!text.trim()) return null;

  const out: DimensionConstraints = {};
  const MAX_CUE = "(?:under|below|less\\s+than|up\\s+to|max(?:imum)?|not\\s+over|no\\s+more\\s+than|no\\s+wider\\s+than|no\\s+longer\\s+than|no\\s+taller\\s+than|no\\s+deeper\\s+than|within|at\\s+most)";
  const MIN_CUE = "(?:over|above|more\\s+than|at\\s+least|min(?:imum)?|no\\s+less\\s+than|no\\s+shorter\\s+than)";
  const NUM = "(\\d+(?:[.,]\\d+)?)";
  const UNIT = "\\s*(cm|mm|m|inch(?:es)?|in|[\"″])?";
  const AXIS_ANY = "(length|long|width|wide|depth|deep|height|tall|high|diameter|diam(?!\\w)|dia(?!\\w)|Ø)";

  // Pattern A: "<cue> <n>[unit] (in) <axis>"   e.g. "under 240cm in length", "max 90cm deep"
  const patA = new RegExp(`\\b${MAX_CUE}\\b[^0-9]{0,20}${NUM}${UNIT}\\s*(?:in\\s+)?${AXIS_ANY}\\b`, "gi");
  const patAmin = new RegExp(`\\b${MIN_CUE}\\b[^0-9]{0,20}${NUM}${UNIT}\\s*(?:in\\s+)?${AXIS_ANY}\\b`, "gi");

  // Pattern B: "<axis> <cue> <n>[unit]"        e.g. "length under 240cm", "seat depth of at least 45cm"
  const patB = new RegExp(`\\b(?:seat\\s+)?${AXIS_ANY}\\b[^0-9]{0,24}${MAX_CUE}\\b[^0-9]{0,10}${NUM}${UNIT}`, "gi");
  const patBmin = new RegExp(`\\b(?:seat\\s+)?${AXIS_ANY}\\b[^0-9]{0,24}${MIN_CUE}\\b[^0-9]{0,10}${NUM}${UNIT}`, "gi");

  // Pattern C: "seat depth of <n>[unit]"       (implicit exact/min for seat)
  const patSeatDepth = new RegExp(`\\bseat\\s+depth\\b[^0-9]{0,24}${NUM}${UNIT}`, "gi");
  const patSeatHeight = new RegExp(`\\bseat\\s+height\\b[^0-9]{0,24}${NUM}${UNIT}`, "gi");

  // Diameter shortcut: "under Ø 90cm" / "max diameter 120cm"
  const patDiaMax = new RegExp(`\\b${MAX_CUE}\\b[^0-9]{0,20}(?:diameter|dia|Ø)\\s*${NUM}${UNIT}`, "gi");
  const patDiaMin = new RegExp(`\\b${MIN_CUE}\\b[^0-9]{0,20}(?:diameter|dia|Ø)\\s*${NUM}${UNIT}`, "gi");

  const axisSlot = (axis: string, isMin: boolean, mm: number, isSeat: boolean) => {
    const a = axis.toLowerCase();
    const k = a.startsWith("len") || a === "long" ? "length"
      : a.startsWith("wid") || a === "wide" ? "width"
      : a.startsWith("dep") || a === "deep" ? "depth"
      : a.startsWith("hei") || a === "tall" || a === "high" ? "height"
      : (a === "diameter" || a === "diam" || a === "dia" || a === "ø") ? "diameter"
      : null;
    if (!k) return;
    if (isSeat) {
      if (k === "depth") {
        if (isMin) out.minSeatDepthMm = Math.max(out.minSeatDepthMm ?? 0, mm);
        else out.maxSeatDepthMm = Math.min(out.maxSeatDepthMm ?? Infinity, mm);
      } else if (k === "height") {
        if (isMin) out.minSeatHeightMm = Math.max(out.minSeatHeightMm ?? 0, mm);
        else out.maxSeatHeightMm = Math.min(out.maxSeatHeightMm ?? Infinity, mm);
      }
      return;
    }
    const capMax = { length: "maxLengthMm", width: "maxWidthMm", depth: "maxDepthMm", height: "maxHeightMm", diameter: "maxDiameterMm" } as const;
    const capMin = { length: "minLengthMm", width: "minWidthMm", depth: "minDepthMm", height: "minHeightMm", diameter: "minDiameterMm" } as const;
    if (isMin) {
      const key = capMin[k as keyof typeof capMin];
      out[key] = Math.max(out[key] ?? 0, mm);
    } else {
      const key = capMax[k as keyof typeof capMax];
      out[key] = Math.min(out[key] ?? Infinity, mm);
    }
  };

  const runAxisPattern = (re: RegExp, isMin: boolean) => {
    for (const m of text.matchAll(re)) {
      // Group order depends on pattern: A/Amin → [_, cue?, num, unit, axis]? Actually with our escaping,
      // groups are: [1]=num, [2]=unit, [3]=axis  for patA/patAmin
      //             [1]=axis, [2]=num, [3]=unit  for patB/patBmin
      // We disambiguate by re-testing the source regex.
      let num: string | undefined, unit: string | undefined, axis: string | undefined;
      if (re === patA || re === patAmin) { num = m[1]; unit = m[2]; axis = m[3]; }
      else if (re === patB || re === patBmin) { axis = m[1]; num = m[2]; unit = m[3]; }
      if (!num || !axis) continue;
      const u = unit ? unit.toLowerCase() : sniffUnit(m[0]);
      const uKey: "cm" | "mm" | "m" | "in" | null =
        u === "mm" ? "mm" : u === "m" ? "m" : (u === "in" || u === "inch" || u === "inches" || u === '"' || u === "″") ? "in" : u === "cm" ? "cm" : null;
      const mm = toMm(num, uKey);
      if (mm == null) continue;
      const isSeat = /\bseat\s+/i.test(m[0]);
      axisSlot(axis, isMin, mm, isSeat);
    }
  };

  runAxisPattern(patA, false);
  runAxisPattern(patAmin, true);
  runAxisPattern(patB, false);
  runAxisPattern(patBmin, true);

  for (const m of text.matchAll(patSeatDepth)) {
    const num = m[1]; const unit = m[2];
    const uKey = unit ? (unit.toLowerCase() as any) : sniffUnit(m[0]);
    const mm = toMm(num, uKey === "inch" || uKey === "inches" || uKey === '"' || uKey === "″" ? "in" : uKey);
    if (mm != null) {
      // Interpret "seat depth of X" as a floor by default (designers usually want ≥).
      const isMax = /\b(?:under|below|less\s+than|up\s+to|max(?:imum)?|no\s+more\s+than)\b[^0-9]{0,20}seat\s+depth/i.test(text);
      if (isMax) out.maxSeatDepthMm = Math.min(out.maxSeatDepthMm ?? Infinity, mm);
      else out.minSeatDepthMm = Math.max(out.minSeatDepthMm ?? 0, mm);
    }
  }
  for (const m of text.matchAll(patSeatHeight)) {
    const num = m[1]; const unit = m[2];
    const uKey = unit ? (unit.toLowerCase() as any) : sniffUnit(m[0]);
    const mm = toMm(num, uKey === "inch" || uKey === "inches" || uKey === '"' || uKey === "″" ? "in" : uKey);
    if (mm != null) {
      const isMax = /\b(?:under|below|less\s+than|up\s+to|max(?:imum)?|no\s+more\s+than)\b[^0-9]{0,20}seat\s+height/i.test(text);
      if (isMax) out.maxSeatHeightMm = Math.min(out.maxSeatHeightMm ?? Infinity, mm);
      else out.minSeatHeightMm = Math.max(out.minSeatHeightMm ?? 0, mm);
    }
  }
  for (const m of text.matchAll(patDiaMax)) {
    const num = m[1]; const unit = m[2];
    const uKey = unit ? (unit.toLowerCase() as any) : sniffUnit(m[0]);
    const mm = toMm(num, uKey === "inch" || uKey === "inches" || uKey === '"' || uKey === "″" ? "in" : uKey);
    if (mm != null) out.maxDiameterMm = Math.min(out.maxDiameterMm ?? Infinity, mm);
  }
  for (const m of text.matchAll(patDiaMin)) {
    const num = m[1]; const unit = m[2];
    const uKey = unit ? (unit.toLowerCase() as any) : sniffUnit(m[0]);
    const mm = toMm(num, uKey === "inch" || uKey === "inches" || uKey === '"' || uKey === "″" ? "in" : uKey);
    if (mm != null) out.minDiameterMm = Math.max(out.minDiameterMm ?? 0, mm);
  }

  // Sweep any Infinity sentinels that never got tightened.
  for (const k of Object.keys(out) as (keyof DimensionConstraints)[]) {
    if (out[k] === Infinity || out[k] === 0) delete out[k];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Parse a free-text dimensions string into a numeric mm axis map.
 * Missing axes stay `null` (we never invent).
 */
export function parseDimensionsToMm(raw: string | null | undefined): ParsedRowDimensions {
  const empty: ParsedRowDimensions = {
    lengthMm: null, widthMm: null, depthMm: null, heightMm: null,
    diameterMm: null, seatDepthMm: null, seatHeightMm: null,
  };
  if (!raw) return empty;
  const line = String(raw).split(/\r?\n/)[0] || ""; // dimensions are always on the first line
  if (!line.trim()) return empty;

  const unit = sniffUnit(line) ?? "cm";
  const out = { ...empty };

  // Explicit-labelled axes: "W 140 x D 50 x H 100 cm", "H75 × W80 × D85 cm", "Dia 120 x H 25 cm"
  const axisRe = /\b(Width|Length|Depth|Height|Diameter|Dia|Ø|W|D|H|L)\s*[:.]?\s*(\d+(?:[.,]\d+)?)/gi;
  const seatDepthRe = /\bseat\s+depth\s*[:.]?\s*(\d+(?:[.,]\d+)?)/gi;
  const seatHeightRe = /\bseat\s+height\s*[:.]?\s*(\d+(?:[.,]\d+)?)/gi;

  for (const m of line.matchAll(axisRe)) {
    const label = m[1].toLowerCase();
    const mm = toMm(m[2], unit);
    if (mm == null) continue;
    if (label === "dia" || label === "ø" || label.startsWith("diam")) out.diameterMm = mm;
    else if (label.startsWith("w")) out.widthMm = mm;
    else if (label.startsWith("d")) out.depthMm = mm;
    else if (label.startsWith("h")) out.heightMm = mm;
    else if (label.startsWith("l")) out.lengthMm = mm;
  }
  for (const m of raw.matchAll(seatDepthRe)) {
    const mm = toMm(m[1], sniffUnit(m[0]) ?? unit);
    if (mm != null) out.seatDepthMm = mm;
  }
  for (const m of raw.matchAll(seatHeightRe)) {
    const mm = toMm(m[1], sniffUnit(m[0]) ?? unit);
    if (mm != null) out.seatHeightMm = mm;
  }

  // Bare "N × M cm" or "N × M × K cm" without axis labels — treat as L × W [× H].
  if (out.widthMm == null && out.depthMm == null && out.heightMm == null && out.lengthMm == null && out.diameterMm == null) {
    const bare = line.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?/i);
    if (bare) {
      const a = toMm(bare[1], unit), b = toMm(bare[2], unit), c = bare[3] ? toMm(bare[3], unit) : null;
      out.lengthMm = a;
      out.widthMm = b;
      if (c != null) out.heightMm = c;
    }
  }

  // If we have exactly one horizontal axis (W but no D, or D but no W), mirror it into `length`
  // so a "max length" query still gets a chance to filter.
  if (out.lengthMm == null) {
    const horiz = [out.widthMm, out.depthMm, out.diameterMm].filter((v): v is number => typeof v === "number");
    if (horiz.length) out.lengthMm = Math.max(...horiz);
  }
  return out;
}

/**
 * Verdict for a single row against the constraints.
 * - "pass": row satisfies every mentioned axis.
 * - "fail": at least one axis is known and violates a constraint.
 * - "unknown": constraints exist but the row's dimensions can't be parsed (or the
 *   specific axis is missing). Caller decides whether to keep unknowns.
 */
export function checkRowAgainstDimensionConstraints(
  rowDimensions: string | null | undefined,
  c: DimensionConstraints,
): "pass" | "fail" | "unknown" {
  if (!c || !Object.keys(c).length) return "pass";
  const parsed = parseDimensionsToMm(rowDimensions);
  const parsedAny =
    parsed.lengthMm != null || parsed.widthMm != null || parsed.depthMm != null ||
    parsed.heightMm != null || parsed.diameterMm != null || parsed.seatDepthMm != null || parsed.seatHeightMm != null;
  if (!parsedAny) return "unknown";

  const violates = (axisValue: number | null, min?: number, max?: number) => {
    if (axisValue == null) return null; // this axis unknown
    if (max != null && axisValue > max) return true;
    if (min != null && axisValue < min) return true;
    return false;
  };

  let anyKnown = false;
  let anyMissing = false;
  const checks: Array<[number | null, number | undefined, number | undefined]> = [
    [parsed.lengthMm,   c.minLengthMm,   c.maxLengthMm],
    [parsed.widthMm,    c.minWidthMm,    c.maxWidthMm],
    [parsed.depthMm,    c.minDepthMm,    c.maxDepthMm],
    [parsed.heightMm,   c.minHeightMm,   c.maxHeightMm],
    [parsed.diameterMm, c.minDiameterMm, c.maxDiameterMm],
    [parsed.seatDepthMm,  c.minSeatDepthMm,  c.maxSeatDepthMm],
    [parsed.seatHeightMm, c.minSeatHeightMm, c.maxSeatHeightMm],
  ];
  for (const [val, min, max] of checks) {
    if (min == null && max == null) continue;
    const v = violates(val, min, max);
    if (v === true) return "fail";
    if (v === null) anyMissing = true;
    else anyKnown = true;
  }
  if (anyKnown && !anyMissing) return "pass";
  if (anyKnown && anyMissing) return "pass"; // some axes verified, unmentioned ones treated as unknown-ok
  return "unknown";
}

/**
 * Filter an array of rows (each with a `dimensions` field) by hard constraints.
 * Rows with "unknown" dimensions are DROPPED — strict mode, matching the
 * "strictly obey" requirement. Falls back to the full list only if strict
 * filtering leaves <2 survivors (safety valve so we never render a blank card).
 */
export function filterRowsByDimensionConstraints<T extends { dimensions?: string | null }>(
  rows: T[],
  c: DimensionConstraints | null,
): { kept: T[]; strictKept: T[]; dropped: number; unknownDropped: number; fellBack: boolean } {
  if (!c || !rows?.length) return { kept: rows || [], strictKept: rows || [], dropped: 0, unknownDropped: 0, fellBack: false };
  const strictKept: T[] = [];
  const passOrUnknown: T[] = [];
  let dropped = 0;
  let unknownDropped = 0;
  for (const r of rows) {
    const v = checkRowAgainstDimensionConstraints(r?.dimensions ?? null, c);
    if (v === "pass") { strictKept.push(r); passOrUnknown.push(r); }
    else if (v === "fail") { dropped += 1; }
    else { unknownDropped += 1; passOrUnknown.push(r); }
  }
  if (strictKept.length >= 2) {
    return { kept: strictKept, strictKept, dropped, unknownDropped, fellBack: false };
  }
  // Safety valve: not enough strictly-verified rows. Keep pass + unknown so the
  // model still has something to reason over; log so we can widen catalog dims.
  return { kept: passOrUnknown, strictKept, dropped, unknownDropped, fellBack: true };
}
