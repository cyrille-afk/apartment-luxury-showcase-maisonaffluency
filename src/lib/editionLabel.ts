/**
 * Compose the displayed edition badge for a curator pick.
 *
 * Priority:
 *   1. Manual `edition` text (override) — used verbatim when set.
 *   2. Auto-compose from structured `edition_number` + `edition_signing`.
 *      e.g. number "1/8" + signing "Signed and dated by the artist"
 *           → "Edition 1/8 — Signed and dated by the artist"
 *   3. Either field alone when only one is provided.
 *
 * Returns null when no edition info is present.
 */
export function formatEditionLabel(input: {
  edition?: string | null;
  edition_number?: string | null;
  edition_signing?: string | null;
}): string | null {
  const manual = (input.edition ?? "").trim();
  if (manual) return manual;

  const number = (input.edition_number ?? "").trim();
  const signing = (input.edition_signing ?? "").trim();

  const parts: string[] = [];
  if (number) parts.push(`Edition ${number}`);
  if (signing) parts.push(signing);

  if (parts.length === 0) return null;
  return parts.join(" — ");
}

/** Editorial edition line for product-card metadata. */
export function formatCuratorialEditionLine(input: {
  edition?: string | null;
  edition_number?: string | null;
  edition_signing?: string | null;
  tags?: string[] | null;
}): string | null {
  const structured = formatEditionLabel(input);
  if (structured) return structured;

  const editionTag = (input.tags ?? []).find((tag) => /\b(?:limited|curator(?:'s)?|numbered)\s+edition\b|\bedition\s+of\s+\d+/i.test(tag));
  return editionTag?.trim() || null;
}

const normalizeHouseName = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** True when a product is edited by Ecart, including Ecart's designer family. */
export function isEcartReedition(input: {
  designerName?: string | null;
  founder?: string | null;
  parentBrand?: string | null;
  reeditionBy?: string | null;
}): boolean {
  return [input.designerName, input.founder, input.parentBrand, input.reeditionBy]
    .map(normalizeHouseName)
    .some((value) => value === "ecart" || value === "ecart paris" || value.startsWith("ecart - "));
}

export const ECART_REEDITION_LABEL = "Reedition";
