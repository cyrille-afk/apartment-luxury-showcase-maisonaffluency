export const COMPLEMENT_PAGE_SIZE = 6;

/** Finish the pool (including its short final page) before returning to page zero. */
export function nextComplementPage(page: number, candidateCount: number): number {
  const pageCount = Math.ceil(candidateCount / COMPLEMENT_PAGE_SIZE);
  return pageCount > 0 ? (page + 1) % pageCount : 0;
}

export function complementPage<T>(candidates: T[], page: number): T[] {
  const start = page * COMPLEMENT_PAGE_SIZE;
  return candidates.slice(start, start + COMPLEMENT_PAGE_SIZE);
}