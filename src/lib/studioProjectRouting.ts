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

/** The project a destination belongs to: its path first, then the `?project=` filter. */
export function resolvedProjectId(pathname: string, search: unknown): string | null {
  const fromPath = pathname.match(/^\/trade\/projects\/([^/?#]+)/);
  if (fromPath?.[1]) {
    try { return decodeURIComponent(fromPath[1]); } catch { return fromPath[1]; }
  }
  if (search && typeof search === 'object') {
    const value = (search as Record<string, unknown>).project;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** True only when the destination opens a different concrete project. */
export function projectSwitchesAway(currentProjectId: string | null | undefined, next: { pathname: string; search?: unknown }): boolean {
  const target = resolvedProjectId(next.pathname, next.search);
  return target !== null && target !== (currentProjectId?.trim() || null);
}