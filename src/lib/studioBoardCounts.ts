type BoardItem = { id: string; product_id: string; variant_label?: string | null; wood_label?: string | null; fabric_label?: string | null };
type SavedSelection = { project_id?: string; item_key: string; selection: unknown };

/** Mirror Studio's first-entry configuration grouping without changing source rows. */
export function studioBoardCount(items: BoardItem[], saved: SavedSelection[], projectId: string): number {
  const exclusions = new Set(saved.filter(row => (!row.project_id || row.project_id === projectId) && row.selection && typeof row.selection === "object" && "excluded" in row.selection && row.selection.excluded === true).map(row => row.item_key));
  const groups = new Map<string, boolean>();
  return items.reduce((count, item) => {
    const finish = [item.variant_label, item.wood_label, item.fabric_label].filter(Boolean).join(" / ") || null;
    const key = JSON.stringify([item.product_id, finish]);
    if (!groups.has(key)) groups.set(key, !exclusions.has(item.id));
    return count + (groups.get(key) ? 1 : 0);
  }, 0);
}