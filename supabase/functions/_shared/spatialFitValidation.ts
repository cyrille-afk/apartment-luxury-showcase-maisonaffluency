// Pure helpers for the spatial-fit flow in trade-concierge.
// Kept side-effect-free and dependency-free so they can be unit-tested in isolation.

export type PreflightCode =
  | "plan_not_found"
  | "plan_not_ready"
  | "room_not_detected"
  | "piece_not_found"
  | "missing_dimensions";

export type ResultFailedValidation =
  | PreflightCode
  | "service_unreachable"
  | "no_verdict"
  | "other";

/**
 * Parse a clearance string ("50cm", "0.6m", "24\"", "600", 600) into millimetres.
 * Returns null when the input can't be parsed. Values out of the [0, 3000] range
 * are still returned and must be range-checked by the caller.
 */
export function coerceClearance(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(mm|cm|m|in|"|')?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  switch (m[2]) {
    case "cm": return Math.round(n * 10);
    case "m":  return Math.round(n * 1000);
    case "in":
    case "\"": return Math.round(n * 25.4);
    case "'":  return Math.round(n * 304.8);
    default:   return Math.round(n);
  }
}

/**
 * Pick the structured failed_validation code for an auto-written 'result' audit row.
 * preflightCode wins (we knew before invoking the checker); transport errors next;
 * then no_verdict; otherwise 'other'.
 */
export function classifyResultFailure(opts: {
  preflightCode: PreflightCode | null;
  transportError: string | null;
  verdict: string | null;
  ok: boolean;
}): ResultFailedValidation | null {
  const isError = opts.ok === false || !opts.verdict;
  if (!isError) return null;
  if (opts.preflightCode) return opts.preflightCode;
  if (opts.transportError) return "service_unreachable";
  if (!opts.verdict) return "no_verdict";
  return "other";
}

/**
 * Count the numeric tokens in a dimensions string (e.g. "W120 × D80 × H75" → 3).
 * Used by the preflight to detect missing product dimensions.
 */
export function countDimensionNumbers(dimensions: string | null | undefined): number {
  const s = String(dimensions || "").trim();
  return (s.match(/\d+(?:\.\d+)?/g) || []).length;
}
