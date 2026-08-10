/**
 * Extract a shared country-of-origin label from a designer's picks.
 *
 * Uses the explicit `origin` field when present, then falls back to scanning
 * the free-form `materials` paragraph for phrases like "Made in Sweden" or
 * "Handmade in Italy". The resulting subtitle is rendered as a small, all-caps
 * heritage line directly beneath the designer's name.
 */

const ORIGIN_MATERIALS_RE =
  /(?:made in|handmade in|crafted in|origin[:\s]*)\s+([A-Za-z][A-Za-z\s]+?)(?:[.,;]|$)/i;

export function extractOriginFromMaterials(
  materials?: string | null,
): string | null {
  if (!materials) return null;
  const m = materials.match(ORIGIN_MATERIALS_RE);
  if (!m) return null;
  return m[1].trim();
}

export function stripOriginFromMaterials(materials?: string | null): string {
  if (!materials) return "";
  return materials
    .replace(ORIGIN_MATERIALS_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,.;]\s*$/, "");
}

export function computeDesignerOrigin(
  picks: { origin?: string | null; materials?: string | null }[],
): string | null {
  const origins = new Set<string>();
  for (const pick of picks) {
    const origin =
      pick.origin?.trim() || extractOriginFromMaterials(pick.materials);
    if (origin) origins.add(origin.toUpperCase());
  }
  if (origins.size !== 1) return null;
  return Array.from(origins)[0];
}

export function formatOriginSubtitle(origin: string | null): string | null {
  if (!origin) return null;
  return `HANDMADE IN ${origin.toUpperCase()}`;
}
