// Public catalogue surfaces must never show pieces belonging to Trade Only or
// unpublished designers — not even as an anonymous placeholder card.

export interface DesignerVisibilityRow {
  id: string;
  is_published?: boolean | null;
  trade_only?: boolean | null;
}

/** Ids of designers that may appear on public pages. */
export function publicDesignerIds(designers: readonly DesignerVisibilityRow[] | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const d of designers ?? []) {
    if (d?.id && d.is_published === true && d.trade_only !== true) ids.add(d.id);
  }
  return ids;
}

/** Drops picks whose designer is Trade Only, unpublished or unknown. */
export function filterPublicPicks<T extends { designer_id?: string | null }>(
  picks: readonly T[],
  designers: readonly DesignerVisibilityRow[] | null | undefined,
): T[] {
  const allowed = publicDesignerIds(designers);
  return picks.filter((p) => !!p.designer_id && allowed.has(p.designer_id));
}
