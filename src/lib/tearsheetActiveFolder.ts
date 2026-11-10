export type TearsheetFolder = { id: string; title: string; project_id: string | null };

/** Active sub-folder for the Tearsheet Builder: URL `folder` first, then the last
 *  visited folder — but only when it belongs to the selected project. Otherwise null
 *  (whole project). */
export function resolveTearsheetActiveFolder(
  folders: TearsheetFolder[],
  projectId: string | null,
  urlFolderId: string | null,
  lastVisitedId: string | null,
): TearsheetFolder | null {
  if (!projectId || urlFolderId === "all") return null; // "all" = whole project chosen explicitly
  const inProject = folders.filter((f) => f.project_id === projectId);
  for (const id of [urlFolderId, lastVisitedId]) {
    const hit = id ? inProject.find((f) => f.id === id) : undefined;
    if (hit) return hit;
  }
  return null;
}
