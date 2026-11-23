import type { Folder } from "./favoriteFolders";

export interface SavedCollection {
  favorites: string[];
  folders: Record<string, Folder>;
  assignments: Record<string, string[]>;
}
export type SavedChange =
  | { kind: "favorite_add" | "favorite_remove" | "folder_remove"; id: string }
  | { kind: "folder_put"; id: string; name: string; createdAt: number }
  | { kind: "assignment_add" | "assignment_remove"; id: string; folderId: string };
export const emptySavedCollection = (): SavedCollection => ({ favorites: [], folders: {}, assignments: {} });

export function savedCollectionChanges(before: SavedCollection, after: SavedCollection): SavedChange[] {
  const changes: SavedChange[] = [];
  for (const id of before.favorites) if (!after.favorites.includes(id)) changes.push({ kind: "favorite_remove", id });
  for (const id of after.favorites) if (!before.favorites.includes(id)) changes.push({ kind: "favorite_add", id });
  for (const id of Object.keys(before.folders)) if (!after.folders[id]) changes.push({ kind: "folder_remove", id });
  for (const folder of Object.values(after.folders)) {
    if (JSON.stringify(before.folders[folder.id]) !== JSON.stringify(folder)) changes.push({ kind: "folder_put", ...folder });
  }
  for (const id of new Set([...Object.keys(before.assignments), ...Object.keys(after.assignments)])) {
    if (!after.favorites.includes(id)) continue; // favorite removal already removes every assignment atomically
    const previous = before.assignments[id] ?? [];
    const next = after.assignments[id] ?? [];
    for (const folderId of previous) if (!next.includes(folderId)) changes.push({ kind: "assignment_remove", id, folderId });
    for (const folderId of next) if (!previous.includes(folderId)) changes.push({ kind: "assignment_add", id, folderId });
  }
  return changes;
}

export function applySavedChanges(value: SavedCollection, changes: SavedChange[]): SavedCollection {
  const next = structuredClone(value);
  for (const change of changes) {
    switch (change.kind) {
      case "favorite_add": if (!next.favorites.includes(change.id)) next.favorites.push(change.id); break;
      case "favorite_remove": next.favorites = next.favorites.filter(id => id !== change.id); delete next.assignments[change.id]; break;
      case "folder_put": next.folders[change.id] = { id: change.id, name: change.name, createdAt: change.createdAt }; break;
      case "folder_remove":
        delete next.folders[change.id];
        for (const id of Object.keys(next.assignments)) next.assignments[id] = (next.assignments[id] ?? []).filter(folderId => folderId !== change.id);
        break;
      case "assignment_add":
        if (!next.folders[change.folderId]) break;
        next.assignments[change.id] = [...new Set([...(next.assignments[change.id] ?? []), change.folderId])];
        if (!next.favorites.includes(change.id)) next.favorites.push(change.id);
        break;
      case "assignment_remove": next.assignments[change.id] = (next.assignments[change.id] ?? []).filter(folderId => folderId !== change.folderId); break;
    }
  }
  return next;
}

export function parseSavedCollection(value: unknown): SavedCollection {
  if (!value || typeof value !== "object") return emptySavedCollection();
  const row = value as Record<string, unknown>;
  const favorites = Array.isArray(row['favorites']) ? row['favorites'].filter((id): id is string => typeof id === "string") : [];
  const folders: Record<string, Folder> = {};
  if (row['folders'] && typeof row['folders'] === "object") {
    for (const item of Object.values(row['folders'])) {
      if (!item || typeof item !== "object") continue;
      const folder = item as Record<string, unknown>;
      if (typeof folder['id'] === "string" && typeof folder['name'] === "string" && typeof folder['createdAt'] === "number") {
        folders[folder['id']] = { id: folder['id'], name: folder['name'], createdAt: folder['createdAt'] };
      }
    }
  }
  const assignments: Record<string, string[]> = {};
  if (row['assignments'] && typeof row['assignments'] === "object") {
    for (const [id, item] of Object.entries(row['assignments'])) {
      if (favorites.includes(id) && Array.isArray(item)) assignments[id] = item.filter((folderId): folderId is string => typeof folderId === "string" && Boolean(folders[folderId]));
    }
  }
  return { favorites: [...new Set(favorites)], folders, assignments };
}