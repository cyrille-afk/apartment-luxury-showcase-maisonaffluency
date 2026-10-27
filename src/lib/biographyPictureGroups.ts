/**
 * Spread the narrative evenly across the pictures so no picture sits beside
 * blank space; any remainder goes to the final pictures.
 */
export function biographyPictureGroups<T>(texts: T[], pictureCount: number): T[][] {
  if (pictureCount <= 0) return texts.length ? [texts] : [];
  const base = Math.floor(texts.length / pictureCount);
  const extra = texts.length % pictureCount;
  const groups: T[][] = [];
  let cursor = 0;
  for (let index = 0; index < pictureCount; index += 1) {
    const size = base + (index >= pictureCount - extra ? 1 : 0);
    groups.push(texts.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}
