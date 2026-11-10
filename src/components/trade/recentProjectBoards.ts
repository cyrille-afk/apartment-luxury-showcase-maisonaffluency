/** Queries supply newest-first boards; the last visited folder (if listed) is promoted to the top. */
export function recentProjectBoards<T extends { id: string; title: string }>(boards: readonly T[], lastVisitedId?: string | null): T[] {
  const last = lastVisitedId ? boards.find((b) => b.id === lastVisitedId) : undefined;
  if (!last) return boards.slice(0, 3);
  return [last, ...boards.filter((b) => b.id !== last.id)].slice(0, 3);
}
