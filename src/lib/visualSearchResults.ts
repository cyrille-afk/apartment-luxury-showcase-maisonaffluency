export const MAX_VISUAL_RESULTS = 24;
export const DEFAULT_VISUAL_RESULTS = 8;

/** Displayed percentages represent cosine similarity, not calibrated probabilities. */
export function visualMatchPercent(similarity: number) {
  return Number.isFinite(similarity) ? Math.round(Math.max(0, Math.min(1, similarity)) * 100) : 0;
}

export function selectVisualMatches<T extends { similarity: number }>(matches: T[], minimumPercent: number, count: number): T[] {
  const minimum = Math.max(0, Math.min(100, minimumPercent));
  const limit = Math.max(1, Math.min(MAX_VISUAL_RESULTS, Math.floor(count)));
  return matches.filter((match) => Number.isFinite(match.similarity) && visualMatchPercent(match.similarity) >= minimum)
    .sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}