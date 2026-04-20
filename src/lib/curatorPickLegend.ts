/**
 * Shared formatting rules for curator pick legends across public grids.
 * Single source of truth so homepage, category, presentation, and tearsheet
 * grids render product copy consistently.
 */

const GENERIC_CATEGORY_TOKENS = [
  "dining table",
  "coffee table",
  "side table",
  "console table",
  "cocktail table",
  "table lamp",
  "floor lamp",
  "reading floor lamp",
  "surface light",
  "pendant",
  "pendant light",
  "wall light",
  "sconce",
  "chandelier",
  "armchair",
  "lounge chair",
  "dining chair",
  "sofa",
  "bench",
  "stool",
  "mirror",
  "rug",
  "credenza",
  "sideboard",
  "cabinet",
  "desk",
  "bed",
  "screen",
];

const EDITION_REGEX = /^(limited\s+)?edition\b/i;

/** Strip " - ..." suffix from a designer/brand name (e.g. "X - for Y" → "X"). */
export function cleanBrandLine(designerName: string | undefined | null): string {
  if (!designerName) return "";
  return designerName.split(" - ")[0].trim();
}

/**
 * Merge generic-category subtitles into the title; suppress edition-like subtitles.
 * Returns the (possibly merged) title and the remaining subtitle (undefined when consumed).
 */
export function composeTitle(
  title: string,
  subtitle?: string | null
): { title: string; remainingSubtitle?: string } {
  const clean = (subtitle ?? "").trim();
  if (!clean) return { title };

  // Edition info belongs to the badge only.
  if (EDITION_REGEX.test(clean)) return { title };

  const lowerSub = clean.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const isGenericCategory = GENERIC_CATEGORY_TOKENS.some(
    (token) => lowerSub === token || lowerSub === token + "s"
  );

  if (isGenericCategory && !lowerTitle.includes(lowerSub)) {
    return { title: `${title} ${clean}` };
  }
  if (isGenericCategory && lowerTitle.includes(lowerSub)) {
    return { title };
  }

  return { title, remainingSubtitle: clean };
}
