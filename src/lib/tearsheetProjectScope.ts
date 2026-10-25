export function requireTearsheetProject(projectId: string | null | undefined): string {
  if (!projectId) throw new Error("Choose or create a project first.");
  return projectId;
}

export function assertTearsheetBoardProject(projectId: string | null | undefined, boardProjectId: string | null | undefined): void {
  const required = requireTearsheetProject(projectId);
  if (boardProjectId !== required) throw new Error("Choose a board from the selected project.");
}