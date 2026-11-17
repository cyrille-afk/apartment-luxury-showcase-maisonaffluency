/** A missing/invalid selection never means all project folders. */
export function selectedStudioBoard<T extends { id: string }>(boards: T[], requested: string | null): T | null {
  if (requested) return boards.find(board => board.id === requested) ?? null;
  return boards.length === 1 ? boards[0] : null;
}

export function studioBoardItems<T extends { board_id: string }>(items: T[], boardId: string): T[] {
  return items.filter(item => item.board_id === boardId);
}