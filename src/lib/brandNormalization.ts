const PARENT_BRAND_BY_CHILD_NAME: Record<string, string> = {
  "okha design studio - adam courts": "OKHA",
  "ecart - jean-michel frank": "Ecart",
  "noé duchaufour-lawrance": "NDL Editions",
  "noe duchaufour-lawrance": "NDL Editions",
  "achille salvagni": "AS Atelier",
};

export function normalizeBrandToParent(brandName: string | null | undefined): string {
  const raw = brandName?.trim();
  if (!raw) return "";
  return PARENT_BRAND_BY_CHILD_NAME[raw.toLowerCase()] ?? raw;
}
