// Parse free-text product dimensions into width / depth / height in cm.
// Handles formats like:
//   "W 200 × D 90 × H 75 cm"
//   "200 x 90 x 75 cm"
//   "Ø 120 x H 75 cm"  (treat as square footprint = diameter)
//   "L 220 W 95 H 78 cm"
const num = (s: string) => {
  const m = s.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

export function parseDimensionsCm(input: string | null | undefined): {
  width_cm: number;
  depth_cm: number;
  height_cm: number | null;
} {
  const fallback = { width_cm: 80, depth_cm: 80, height_cm: null as number | null };
  if (!input) return fallback;
  const s = input.toLowerCase().replace(/,/g, ".");

  // Labelled (W/D/H or L/W/H)
  const w = s.match(/(?:w|width|l|length)\s*[:.]?\s*([\d.]+)/);
  const d = s.match(/(?:d|depth|p|prof)\s*[:.]?\s*([\d.]+)/);
  const h = s.match(/(?:h|height|haut)\s*[:.]?\s*([\d.]+)/);
  if (w && d) {
    return {
      width_cm: parseFloat(w[1]),
      depth_cm: parseFloat(d[1]),
      height_cm: h ? parseFloat(h[1]) : null,
    };
  }

  // Diameter (round table / pouf)
  const dia = s.match(/(?:ø|diam|⌀)\s*[:.]?\s*([\d.]+)/);
  if (dia) {
    const v = parseFloat(dia[1]);
    return { width_cm: v, depth_cm: v, height_cm: h ? parseFloat(h[1]) : null };
  }

  // Bare A x B x C
  const triple = s.match(/([\d.]+)\s*[x×]\s*([\d.]+)(?:\s*[x×]\s*([\d.]+))?/);
  if (triple) {
    const a = parseFloat(triple[1]);
    const b = parseFloat(triple[2]);
    const c = triple[3] ? parseFloat(triple[3]) : null;
    // Assume first = width, second = depth (if 3 values) or height (if 2).
    if (c !== null) return { width_cm: a, depth_cm: b, height_cm: c };
    return { width_cm: a, depth_cm: a, height_cm: b };
  }

  const single = num(s);
  if (single) return { width_cm: single, depth_cm: single, height_cm: null };
  return fallback;
}
