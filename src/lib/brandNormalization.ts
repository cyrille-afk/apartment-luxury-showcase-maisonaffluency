const PARENT_BRAND_BY_CHILD_NAME: Record<string, string> = {
  "okha design studio - adam courts": "OKHA",
  "ecart - jean-michel frank": "Ecart",
  "noé duchaufour-lawrance": "NDL Editions",
  "noe duchaufour-lawrance": "NDL Editions",
  "achille salvagni": "Achille Salvagni Atelier",
  "as atelier": "Achille Salvagni Atelier",
  "alinea": "Alinea Design Objects",
  "alinéa": "Alinea Design Objects",
  "leo aerts": "Alinea Design Objects",
};

export function normalizeBrandToParent(brandName: string | null | undefined): string {
  const raw = brandName?.trim();
  if (!raw) return "";
  return PARENT_BRAND_BY_CHILD_NAME[raw.toLowerCase()] ?? raw;
}
