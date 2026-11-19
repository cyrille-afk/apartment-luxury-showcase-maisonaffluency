export type FolderCanvasItem = { id: string; folderItemId?: string; locked?: boolean };
export function folderChanges(original: FolderCanvasItem[], current: FolderCanvasItem[]) {
  const retained = new Set(current.map(item => item.folderItemId).filter(Boolean));
  return {
    removed: original.filter(item => item.folderItemId && !retained.has(item.folderItemId) && !item.locked),
    added: current.filter(item => !item.folderItemId),
  };
}
export const moodFolderUrl = (projectId: string | null, boardId: string) => `/trade/mood-boards?${new URLSearchParams({ ...(projectId ? { project: projectId } : {}), board: boardId })}`;