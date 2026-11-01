/** Queries supply newest-first boards; quick save never changes their order. */
export function recentProjectBoards<T extends { id: string; title: string }>(boards: readonly T[]): T[] {
  return boards.slice(0, 3);
}