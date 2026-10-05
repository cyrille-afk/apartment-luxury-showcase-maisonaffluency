// Shared folder-name canonicalization for the ChatGPT extension tools.
// Two DB rows whose names differ only in case/whitespace are the same folder
// to ChatGPT, so every lookup and every listing must key on this form.

export function normalizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Pick the canonical folder for a normalized name from an updated_at-desc
 * list: the most recently touched row wins, so the casing shown in ChatGPT
 * matches the casing last used in the portal.
 */
export function pickCanonicalFolder<T extends { name: string }>(
  projects: T[],
  targetName: string,
): T | undefined {
  const key = normalizeFolderName(targetName)
  return projects.find((p) => normalizeFolderName(p.name) === key)
}
