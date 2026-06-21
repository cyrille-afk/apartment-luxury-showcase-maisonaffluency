// Pure helpers for the Axonometric CAD QA pipeline.
// Mirrored (inline) inside supabase/functions/axonometric-generate so that the
// edge function and the vitest unit test stay in lock-step.

export type BBoxMm = { w?: number | null; d?: number | null; h?: number | null };
export type DimCm = { w: number | null; d: number | null; h: number | null };
export type CadQaStatus = "match" | "mismatch" | "no_cad" | "cad_unparsed";

export interface CadQaResult {
  status: CadQaStatus;
  expected_dim_text: string | null;
  expected_bbox_mm: BBoxMm | null;
  delta_cm: DimCm | null;
}

/** Parse a free-text dimension string like "W65 × D58 × H79 cm" into cm values. */
export function parseDimText(text: string | null | undefined): DimCm | null {
  if (!text) return null;
  const s = text.replace(/\s+/g, " ");
  // mm → convert to cm; otherwise treat numbers as cm (default).
  const isMm = /\bmm\b/i.test(s) && !/\bcm\b/i.test(s);
  const grab = (letter: string): number | null => {
    const re = new RegExp(`${letter}\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const m = s.match(re);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    return isMm ? n / 10 : n;
  };
  const w = grab("W");
  const d = grab("D");
  const h = grab("H");
  if (w == null && d == null && h == null) return null;
  return { w, d, h };
}

export function formatCadDim(bbox: BBoxMm): { text: string; cm: DimCm } | null {
  if (!bbox || !bbox.w || !bbox.d) return null;
  const w = Math.round(bbox.w / 10);
  const d = Math.round(bbox.d / 10);
  const h = bbox.h ? Math.round(bbox.h / 10) : 0;
  const text = h
    ? `W${w} × D${d} × H${h} cm (from CAD)`
    : `W${w} × D${d} cm (from CAD)`;
  return { text, cm: { w, d, h: h || null } };
}

/**
 * Compare what the prompt builder wants to send to the model
 * (`appliedDimText`) against the parsed CAD bbox for this product.
 */
export function computeCadQa(params: {
  originalDimText: string | null | undefined; // user-supplied / free-text before override
  appliedDimText: string | null | undefined;  // what actually goes into the prompt
  cadGeometry: { bbox_mm: BBoxMm | null; status: string } | null;
  toleranceCm?: number;
}): CadQaResult {
  const tol = params.toleranceCm ?? 1;
  if (!params.cadGeometry) {
    return { status: "no_cad", expected_dim_text: null, expected_bbox_mm: null, delta_cm: null };
  }
  if (params.cadGeometry.status !== "ready" || !params.cadGeometry.bbox_mm?.w || !params.cadGeometry.bbox_mm?.d) {
    return { status: "cad_unparsed", expected_dim_text: null, expected_bbox_mm: params.cadGeometry.bbox_mm ?? null, delta_cm: null };
  }
  const formatted = formatCadDim(params.cadGeometry.bbox_mm)!;
  const applied = parseDimText(params.appliedDimText);
  if (!applied) {
    // No applied dimensions at all — that's a mismatch (CAD existed but wasn't injected).
    return {
      status: "mismatch",
      expected_dim_text: formatted.text,
      expected_bbox_mm: params.cadGeometry.bbox_mm,
      delta_cm: { w: null, d: null, h: null },
    };
  }
  const delta: DimCm = {
    w: applied.w != null && formatted.cm.w != null ? applied.w - formatted.cm.w : null,
    d: applied.d != null && formatted.cm.d != null ? applied.d - formatted.cm.d : null,
    h: applied.h != null && formatted.cm.h != null ? applied.h - formatted.cm.h : null,
  };
  const mismatch = (Object.values(delta) as Array<number | null>).some(
    (v) => v != null && Math.abs(v) > tol,
  );
  return {
    status: mismatch ? "mismatch" : "match",
    expected_dim_text: formatted.text,
    expected_bbox_mm: params.cadGeometry.bbox_mm,
    delta_cm: delta,
  };
}
