/**
 * Builds the finish line shown on cart / checkout / quote rows.
 *
 * Two sources describe the same choice:
 *  - the VARIANT AXIS value ("Sheepskin SKANDILOCK", "Oiled Oak") — the
 *    supplier's upholstery/wood reference, which drives pricing;
 *  - the SWATCH name displayed in the selector ("Sheepskin 09 Moonlight",
 *    "Oiled Walnut") — the colourway the shopper actually sees.
 *
 * Historically the order line carried only the axis value, so a shopper who
 * saw "Sheepskin 09 Moonlight" got "Sheepskin SKANDILOCK" in their basket.
 * These helpers merge both so the reference AND the colourway are shown.
 */

const norm = (v?: string | null) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const tokens = (v: string) => norm(v).split(" ").filter(Boolean);

/** Merge one axis reference with the swatch colourway displayed for it. */
export const mergeFinishFacet = (
  axisValue?: string | null,
  swatchName?: string | null,
): string | null => {
  const axis = (axisValue || "").trim();
  const swatch = (swatchName || "").trim();
  if (!axis) return swatch || null;
  if (!swatch) return axis;

  const a = norm(axis);
  const s = norm(swatch);
  if (a === s) return swatch;
  // One fully contains the other → keep the richer string.
  if (a.includes(s)) return axis;
  if (s.includes(a)) return swatch;

  // Shared leading words ("Sheepskin SKANDILOCK" + "Sheepskin 09 Moonlight")
  // → "Sheepskin SKANDILOCK — 09 Moonlight". Only when the axis's extra words
  // are a supplier REFERENCE (all-caps or containing digits); otherwise the
  // two are simply different materials ("Oiled Oak" vs "Oiled Walnut") and
  // merging them would invent a finish that doesn't exist.
  const at = tokens(axis);
  const st = tokens(swatch);
  let shared = 0;
  while (shared < at.length && shared < st.length && at[shared] === st[shared]) shared += 1;
  if (shared > 0 && shared < st.length && shared < at.length) {
    const axisExtra = axis.split(/\s+/).slice(shared);
    const isReference = axisExtra.every((w) => /\d/.test(w) || (w.length > 2 && w === w.toUpperCase()));
    if (isReference) {
      const remainder = swatch.split(/\s+/).slice(shared).join(" ");
      return `${axis} — ${remainder}`;
    }
  }

  // Unrelated values: the swatch is what the shopper is looking at.
  return swatch;
};

/**
 * Compose the full finish label from the selected axis values and the swatch
 * names currently displayed in the selector.
 */
export const composeOrderFinishLabel = (input: {
  base?: string | null;
  top?: string | null;
  size?: string | null;
  displayedBase?: string | null;
  displayedTop?: string | null;
  displayedUpholstery?: string | null;
}): string | null => {
  const parts = [
    mergeFinishFacet(input.base, input.displayedBase),
    mergeFinishFacet(input.top, input.displayedTop ?? input.displayedUpholstery),
    (input.size || "").trim() || null,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const k = norm(p);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.length ? unique.join(" / ") : null;
};
