export const LAST_VISITED_FOLDER_KEY = "lastVisitedFolderId";

export function readLastVisitedFolderId(): string | null {
  try { return window.localStorage.getItem(LAST_VISITED_FOLDER_KEY); } catch { return null; }
}

export function writeLastVisitedFolderId(id: string): void {
  try { window.localStorage.setItem(LAST_VISITED_FOLDER_KEY, id); } catch { /* storage unavailable */ }
}
