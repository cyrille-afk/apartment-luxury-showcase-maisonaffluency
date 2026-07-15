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

/**
 * Reorder picks so that no two adjacent items share the same subcategory,
 * while staying as close as possible to the input order. Greedy: at each
 * position, if the next item's subcategory matches the previous placed one,
 * swap in the first later item with a different subcategory.
 */
export function interleaveBySubcategory<T extends { subcategory?: string | null; category?: string | null }>(rows: T[]): T[] {
  if (rows.length < 3) return rows.slice();
  const keyOf = (r: T) => ((r.subcategory || r.category || "") as string).trim().toLowerCase();
  const out = rows.slice();
  for (let i = 1; i < out.length; i++) {
    if (keyOf(out[i]) !== keyOf(out[i - 1])) continue;
    // find the next item with a different subcategory
    let swapIdx = -1;
    for (let j = i + 1; j < out.length; j++) {
      if (keyOf(out[j]) !== keyOf(out[i - 1])) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx === -1) break; // remaining items are all the same — nothing to do
    const tmp = out[i];
    out[i] = out[swapIdx];
    out[swapIdx] = tmp;
  }
  return out;
}
