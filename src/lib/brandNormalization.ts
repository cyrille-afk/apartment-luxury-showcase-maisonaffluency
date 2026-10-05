/**
 * Maps product maker-name variants (spelling, accents, casing, house suffixes)
 * onto the single canonical name of the maker's published profile, so each
 * maker appears once across filters, cards and counts.
 * Keys are accent-folded, lower-cased and whitespace-collapsed (see foldKey).
 */
const foldKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/gi, "o")
    .replace(/ř/gi, "r")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const RAW_ALIASES: Record<string, string> = {
  // "Okha Design Studio - Adam Courts" merged into single OKHA record (DB-side) on 2026-04-21.
  "ecart - jean-michel frank": "Ecart",
  "ecart international": "Ecart",
  "ndl editions": "Noé Duchaufour-Lawrance",
  "achille salvagni": "Achille Salvagni Atelier",
  "as atelier": "Achille Salvagni Atelier",
  "alinea": "Alinea",
  "alinea design objects": "Alinea",
  "leo aerts": "Alinea",
  "atelier bdm - bruno de maistre": "Atelier BdM",
  "atelier fevrier": "Atelier Février",
  "atelier fevrier - florian & lisa mukhia pretet": "Atelier Février",
  "atelier fevrier - isha mukhia pretet & florian pretet": "Atelier Février",
  "charles paris - felix agostini": "Felix Agostini",
  "maison charles paris": "Felix Agostini",
  "eric schmitt studio": "Eric Schmitt Studio",
  "jindrich halabala": "Jindrich Halabala",
  "made in kira": "Made in Kira",
  "made in kira - roman frankel": "Made in Kira",
  "mernoe": "Mernøe",
  "nathalie ziegler pasqua": "Nathalie Ziegler",
  "reda amalou design": "Reda Amalou",
  "sollen design": "Sollen",
};

const PARENT_BRAND_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_ALIASES).map(([k, v]) => [foldKey(k), v]),
);

export function normalizeBrandToParent(brandName: string | null | undefined): string {
  const raw = brandName?.trim();
  if (!raw) return "";
  return PARENT_BRAND_BY_KEY[foldKey(raw)] ?? raw.replace(/\s+/g, " ");
}
