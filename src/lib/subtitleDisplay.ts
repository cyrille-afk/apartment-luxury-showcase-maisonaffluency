/**
 * Product `subtitle` is used for two very different things:
 *  - an attributed maker/designer ("Arnold Madsen") → rendered as "by Arnold Madsen"
 *  - a material / wood / finish variant ("Oiled Walnut") → rendered as a plain caption
 *
 * This helper decides which one it is so we never print "by Oiled Walnut".
 */
const FINISH_WORDS = [
  "oak", "walnut", "ash", "teak", "beech", "birch", "maple", "mahogany", "rosewood",
  "oiled", "fumed", "smoked", "lacquered", "stained", "ebonised", "ebonized", "bleached",
  "leather", "linen", "velvet", "boucle", "bouclé", "sheepskin", "canvas", "wool",
  "brass", "bronze", "steel", "chrome", "nickel", "copper", "iron", "aluminium", "aluminum",
  "marble", "travertine", "onyx", "stone", "granite", "glass", "ceramic", "resin",
  "black", "white", "natural", "matte", "matt", "gloss", "polished", "brushed", "patinated",
];

export function isFinishSubtitle(subtitle?: string | null): boolean {
  if (!subtitle) return false;
  const words = subtitle.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean);
  if (!words.length) return false;
  return words.some((w) => FINISH_WORDS.includes(w));
}

/** Returns the line to render under the product title, or null. */
export function formatProductSubtitleLine(
  title: string,
  subtitle?: string | null
): string | null {
  if (!subtitle) return null;
  const t = title.toLowerCase();
  const s = subtitle.toLowerCase();
  if (t.includes(s) || s.includes(t)) return null;
  return isFinishSubtitle(subtitle) ? subtitle : `by ${subtitle}`;
}
