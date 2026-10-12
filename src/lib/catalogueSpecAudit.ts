export type SpecIssue = "missing_dimensions" | "missing_materials" | "repeated_dimensions";

export interface SpecAuditInput {
  id: string;
  title: string | null;
  dimensions: string | null;
  materials: string | null;
  materials_description?: string | null;
  size_variants?: unknown;
  linkedFinishCount?: number;
}

const DIM = /(\d+(?:[.,]\d+)?)\s*(?:cm|mm|m|in)?/gi;

/** Strip finish qualifiers like "(Special Shade)" and normalise numbers so identical sizes compare equal. */
export function dimensionKey(segment: string): string {
  const nums = segment.replace(/\([^)]*\)/g, "").match(DIM) ?? [];
  const axes = segment.replace(/\([^)]*\)/g, "").toUpperCase().match(/[ØWDHL]/g) ?? [];
  return `${axes.join("")}:${nums.map((n) => n.replace(/[^\d.,]/g, "").replace(",", ".")).join("x")}`;
}

function variantDims(sv: unknown): string[] {
  if (!Array.isArray(sv)) return [];
  return sv
    .map((v) => (v && typeof v === "object" ? String((v as any).dimensions ?? "").trim() : ""))
    .filter(Boolean);
}

export function hasCatalogueMaterials(p: SpecAuditInput): boolean {
  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  if (hasText(p.materials) || hasText(p.materials_description) || (p.linkedFinishCount ?? 0) > 0) return true;
  if (!Array.isArray(p.size_variants)) return false;
  return p.size_variants.some((variant: unknown) => {
    if (!variant || typeof variant !== "object") return false;
    const fields = variant as Record<string, unknown>;
    return ["base", "top", "materials", "material"].some((key) => hasText(fields[key]));
  });
}

export function auditCatalogueSpec(p: SpecAuditInput): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const dims = (p.dimensions ?? "").trim();
  if (!dims) issues.push("missing_dimensions");
  if (!hasCatalogueMaterials(p)) issues.push("missing_materials");

  const segments = dims ? dims.split(/\s+\/\s+/).filter((s) => /\d/.test(s)) : [];
  const keys = segments.map(dimensionKey);
  const vKeys = variantDims(p.size_variants).map(dimensionKey);
  const dup = (arr: string[]) => new Set(arr).size < arr.length;
  // Per-variant dims identical across all finishes is fine only if not also restated; flag same size listed twice in the main field.
  if (dup(keys) || (vKeys.length > 1 && dup(vKeys) && keys.length > 1)) issues.push("repeated_dimensions");
  return issues;
}

export const SPEC_ISSUE_LABEL: Record<SpecIssue, string> = {
  missing_dimensions: "Missing dimensions",
  missing_materials: "Missing materials",
  repeated_dimensions: "Same dimensions repeated across finishes",
};
