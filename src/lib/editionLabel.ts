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
