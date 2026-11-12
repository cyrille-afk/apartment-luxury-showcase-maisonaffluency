export const specRemovalKey = (userId: string, projectId?: string | null) => `trade-spec-removed-v1:${userId}:${projectId || 'all'}`;
export function retainedSpecItems<T extends { item_id: string }>(items: T[], removed: string[]): T[] {
  const ids = new Set(removed);
  return items.filter(item => !ids.has(item.item_id));
}