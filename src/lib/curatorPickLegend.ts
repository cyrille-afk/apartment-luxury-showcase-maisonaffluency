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
 * Split an editor-style pick title such as "Azores Sofa by Luca Nichetto" into
 * the product name and the attributed designer. Returns designer undefined when
 * the title carries no "by <Name>" suffix.
 */
export function splitTitleAttribution(
  title: string,
  subtitle?: string | null
): { title: string; designer?: string } {
  const match = /^(.*\S)\s+by\s+([^,–—]+)$/i.exec((title || "").trim());
  if (match) {
    const product = match[1].trim();
    const designer = match[2].trim();
    if (product && designer && designer.split(/\s+/).length <= 4) {
      return { title: product, designer };
    }
  }
  const sub = (subtitle ?? "").trim();
  const subMatch = /^by\s+(.+)$/i.exec(sub);
  if (subMatch) return { title: (title || "").trim(), designer: subMatch[1].trim() };
  return { title: (title || "").trim() };
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
