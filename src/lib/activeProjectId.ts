/**
 * Returns the project id the user is currently scoped to (via the cross-page
 * project filter persisted in sessionStorage by `useProjectFilter`). When
 * picking or creating a "draft" quote, callers MUST scope by this id so items
 * never land in an unrelated project's draft quote.
 */
export function getActiveProjectId(): string | null {
  try {
    return sessionStorage.getItem("trade:lastProjectFilter");
  } catch {
    return null;
  }
}
