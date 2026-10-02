/**
 * Compose the displayed edition badge for a curator pick.
 *
 * Priority:
 *   1. Manual `edition` text (override) — normalised for REEDITION labels.
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
  if (manual) return manual.replace(/re[ -]?edition/gi, "REEDITION");

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

export const ECART_REEDITION_LABEL = "REEDITION";

/** Keep the Ecart header badge singular when the catalogue also calls it a re-edition. */
export function productEditionBadge(input: {
  edition?: string | null;
  edition_number?: string | null;
  edition_signing?: string | null;
}, isEcartProduct: boolean): string | null {
  const edition = formatEditionLabel(input);
  if (!isEcartProduct) return edition;
  if (!edition || edition === ECART_REEDITION_LABEL) return ECART_REEDITION_LABEL;
  return `${ECART_REEDITION_LABEL} · ${edition}`;
}

/**
 * Card chip for pieces published by a parent house (designers.founder).
 * Ecart → "Ecart REEDITION" (or plain "REEDITION" on a child designer's page,
 * where the card already credits the house); any other parent →
 * "<House> Edition" (or the house name alone when it already ends in Edition(s)).
 * A house's own pieces get no chip — the house name is already on the card.
 */
export function getHouseEditionLabel(input: {
  designerName?: string | null;
  founder?: string | null;
  parentBrand?: string | null;
  reeditionBy?: string | null;
  /** Designer whose profile page the card sits on. On the house's own page
   * the pieces are by different designers, so the full "Ecart REEDITION"
   * identifies the house; on a child designer's page the card already shows
   * the house, so "REEDITION" alone is enough. */
  pageDesignerName?: string | null;
}): string | null {
  if (isEcartReedition(input)) {
    const page = normalizeHouseName(input.pageDesignerName);
    const pageIsEcartHouse =
      !page || page === "ecart" || page === "ecart paris" || page.startsWith("ecart - ");
    return pageIsEcartHouse ? `Ecart ${ECART_REEDITION_LABEL}` : ECART_REEDITION_LABEL;
  }
  const house = (input.founder || input.parentBrand || input.reeditionBy || "").trim();
  if (!house) return null;
  if (normalizeHouseName(house) === normalizeHouseName(input.designerName)) return null;
  return /(?:^|\s)[ée]ditions?$/i.test(house) ? house : `${house} Edition`;
}
