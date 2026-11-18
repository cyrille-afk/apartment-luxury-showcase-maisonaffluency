/** Only accessible projects can become a Studio destination; never choose an arbitrary first row. */
export function studioProjectId(accessibleIds: string[], activeId: string | null | undefined, recentIds: string[]): string | null {
  if (activeId && accessibleIds.includes(activeId)) return activeId;
  return recentIds.find(id => accessibleIds.includes(id)) ?? null;
}
export function studioProjectHref(projectId: string | null): string {
  return projectId ? `/trade/projects/${encodeURIComponent(projectId)}/studio` : '/trade/project-studio';
}

export function studioTabPreference(explicit: string | null, remembered: string | null): 'admin' | 'canvas' {
  if (explicit === 'admin' || explicit === 'canvas') return explicit;
  return remembered === 'admin' ? 'admin' : 'canvas';
}

export function switchedStudioHref(projectId: string, tab: string | null): string {
  return `${studioProjectHref(projectId)}?project=${encodeURIComponent(projectId)}&tab=${tab === 'admin' ? 'admin' : 'canvas'}`;
}