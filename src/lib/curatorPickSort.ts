/**
 * Shared sort logic for `designer_curator_picks` rows.
 *
 * Used by BOTH the Designer Editor (TradeDesignersAdmin) and the
 * published gallery (useDbCuratorPicks) so the order is always identical.
 *
 * Rules (in priority order):
 *   1. sort_order ASC, NULLs last
 *   2. created_at ASC (stable for same sort_order)
 *   3. id ASC (final deterministic tiebreaker)
 */

export interface SortableCuratorPick {
  id: string;
  sort_order: number | null;
  created_at?: string | null;
}

/** Apply the canonical ordering chain to a Supabase query builder. */
export function applyCuratorPickOrder<Q extends {
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => Q;
}>(query: Q): Q {
  return query
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
}

/** Sort an in-memory array using the same rules (for client-side reordering). */
export function sortCuratorPicks<T extends SortableCuratorPick>(rows: T[]): T[] {
  return [...rows].sort(compareCuratorPicks);
}

export function compareCuratorPicks(a: SortableCuratorPick, b: SortableCuratorPick): number {
  const ao = a.sort_order;
  const bo = b.sort_order;
  const aNull = ao === null || ao === undefined;
  const bNull = bo === null || bo === undefined;
  if (aNull !== bNull) return aNull ? 1 : -1; // nulls last
  if (!aNull && !bNull && ao !== bo) return (ao as number) - (bo as number);

  const ac = a.created_at ?? "";
  const bc = b.created_at ?? "";
  if (ac !== bc) return ac < bc ? -1 : 1;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
