export const LAST_VISITED_FOLDER_KEY = "last_visited_project_folder";

export type LastVisitedFolder = { id: string; name: string };

export function readLastVisitedFolder(): LastVisitedFolder | null {
  try {
    const raw = window.localStorage.getItem(LAST_VISITED_FOLDER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.id === "string" ? { id: v.id, name: typeof v.name === "string" ? v.name : "" } : null;
  } catch { return null; }
}

export function writeLastVisitedFolder(folder: LastVisitedFolder): void {
  try { window.localStorage.setItem(LAST_VISITED_FOLDER_KEY, JSON.stringify(folder)); } catch { /* storage unavailable */ }
}
