/** Browser drafts contain durable image links, never generated image bytes. */
export const AI_RENDER_DRAFT_KEY = "maf:axonometric-studio:draft:v2";

function durableValue(value: unknown): unknown {
  if (typeof value === "string" && /^(data:|blob:)/i.test(value)) return null;
  if (Array.isArray(value)) return value.map(durableValue).filter((entry) => entry != null);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, durableValue(entry)]));
  }
  return value;
}

function compactResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const url = durableValue(result["storedUrl"]) || durableValue(result["imageUrl"]);
  if (typeof url !== "string" || !url) return null;
  return { ...durableValue(result) as Record<string, unknown>, imageUrl: url, storedUrl: url };
}

export function compactAiRenderDraft(draft: Record<string, unknown>): Record<string, unknown> {
  return {
    ...durableValue(draft) as Record<string, unknown>,
    result: compactResult(draft["result"]),
    history: Array.isArray(draft["history"])
      ? draft["history"].slice(0, 8).map(compactResult).filter((entry) => entry != null)
      : [],
  };
}

export function saveAiRenderDraft(storage: Pick<Storage, "setItem">, draft: Record<string, unknown>): void {
  const compact = compactAiRenderDraft(draft);
  try {
    storage.setItem(AI_RENDER_DRAFT_KEY, JSON.stringify(compact));
  } catch (error) {
    if (!(error && typeof error === "object" && "name" in error &&
      (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED"))) throw error;
    // Prioritize the source and settings over optional local render history.
    storage.setItem(AI_RENDER_DRAFT_KEY, JSON.stringify({ ...compact, result: null, history: [] }));
  }
}

/** Shrink legacy base64 drafts before global storage reclamation can evict them. */
export function compactSavedAiRenderDraft(storage: Pick<Storage, "getItem" | "setItem">): void {
  try {
    const raw = storage.getItem(AI_RENDER_DRAFT_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const compact = JSON.stringify(compactAiRenderDraft(parsed as Record<string, unknown>));
    if (compact !== raw) storage.setItem(AI_RENDER_DRAFT_KEY, compact);
  } catch { /* Preserve the existing draft if storage is unavailable. */ }
}