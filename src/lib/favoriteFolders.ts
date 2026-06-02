// Public favorites + Artemest-style folders, all in localStorage.
// Folders are optional: a favorite can exist without belonging to any folder
// (it lives in the implicit "All saved" bucket).

const FAVS_KEY = "public_favorites";
const FOLDERS_KEY = "public_favorite_folders";
const ASSIGN_KEY = "public_favorite_assignments";
export const FAV_EVENT = "public_favorites_changed";
export const FOLDERS_EVENT = "public_favorite_folders_changed";

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

type Assignments = Record<string, string[]>; // pickId -> folderId[]

function safeParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

/* ---------------- Favorites set ---------------- */
export function readFavorites(): string[] {
  return safeParse<string[]>(localStorage.getItem(FAVS_KEY), []);
}
function writeFavorites(ids: string[]) {
  localStorage.setItem(FAVS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(FAV_EVENT));
}
export function isFavorited(id: string): boolean {
  return readFavorites().includes(id);
}
export function addFavorite(id: string) {
  const ids = readFavorites();
  if (!ids.includes(id)) writeFavorites([...ids, id]);
}
export function removeFavorite(id: string) {
  const ids = readFavorites();
  if (ids.includes(id)) writeFavorites(ids.filter((x) => x !== id));
  // also strip from any folder assignments
  const a = readAssignments();
  if (a[id]) {
    delete a[id];
    writeAssignments(a);
  }
}

/* ---------------- Folders ---------------- */
export function readFolders(): Folder[] {
  return safeParse<Folder[]>(localStorage.getItem(FOLDERS_KEY), []);
}
function writeFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  window.dispatchEvent(new Event(FOLDERS_EVENT));
}
export function createFolder(name: string): Folder {
  const trimmed = name.trim();
  const folder: Folder = {
    id: (crypto as any)?.randomUUID?.() ?? `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed || "Untitled folder",
    createdAt: Date.now(),
  };
  writeFolders([...readFolders(), folder]);
  return folder;
}
export function renameFolder(id: string, name: string) {
  writeFolders(readFolders().map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)));
}
export function deleteFolder(id: string) {
  writeFolders(readFolders().filter((f) => f.id !== id));
  const a = readAssignments();
  let changed = false;
  for (const pickId of Object.keys(a)) {
    if (a[pickId].includes(id)) {
      a[pickId] = a[pickId].filter((x) => x !== id);
      if (a[pickId].length === 0) delete a[pickId];
      changed = true;
    }
  }
  if (changed) writeAssignments(a);
}

/* ---------------- Assignments ---------------- */
export function readAssignments(): Assignments {
  return safeParse<Assignments>(localStorage.getItem(ASSIGN_KEY), {});
}
function writeAssignments(a: Assignments) {
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(a));
  window.dispatchEvent(new Event(FAV_EVENT));
}
export function getFoldersForPick(pickId: string): string[] {
  return readAssignments()[pickId] ?? [];
}
export function setFoldersForPick(pickId: string, folderIds: string[]) {
  const a = readAssignments();
  if (folderIds.length === 0) delete a[pickId];
  else a[pickId] = [...new Set(folderIds)];
  writeAssignments(a);
  // Ensure the pick is in the favorites set when assigned to any folder
  if (folderIds.length > 0 && !readFavorites().includes(pickId)) addFavorite(pickId);
}
export function togglePickInFolder(pickId: string, folderId: string) {
  const current = getFoldersForPick(pickId);
  const next = current.includes(folderId)
    ? current.filter((f) => f !== folderId)
    : [...current, folderId];
  setFoldersForPick(pickId, next);
}
export function picksInFolder(folderId: string): string[] {
  const a = readAssignments();
  return Object.keys(a).filter((pid) => a[pid].includes(folderId));
}
