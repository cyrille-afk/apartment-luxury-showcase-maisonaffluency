// Public catalogue surfaces consume only the safe product projection. Each
// product's own Trade Only setting controls its visibility; a maker's Trade
// Only setting protects their profile without overriding a published product.

export interface DesignerVisibilityRow {
  id: string;
  is_published?: boolean | null;
  trade_only?: boolean | null;
}

/** Ids of published designers whose safe credit may accompany a public pick. */
export function publicDesignerIds(designers: readonly DesignerVisibilityRow[] | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const d of designers ?? []) {
    if (d?.id && d.is_published === true) ids.add(d.id);
  }
  return ids;
}

/** Drops picks whose maker is unpublished or has no safe public credit. */
export function filterPublicPicks<T extends { designer_id?: string | null }>(
  picks: readonly T[],
  designers: readonly DesignerVisibilityRow[] | null | undefined,
): T[] {
  const allowed = publicDesignerIds(designers);
  return picks.filter((p) => !!p.designer_id && allowed.has(p.designer_id));
}
