import { useCallback, useEffect, useRef, useState } from "react";
import { comparatorDraftKey, emptyComparatorDraft, sanitizeComparatorDraft, type ComparatorDraft } from "@/lib/comparatorDraft";

export function useComparatorDraft(userId: string | undefined, shortlistId: string | null) {
  const key = userId ? comparatorDraftKey(userId, shortlistId) : null;
  const [loaded, setLoaded] = useState<{ key: string | null; draft: ComparatorDraft; stored: boolean }>({ key: null, draft: emptyComparatorDraft(), stored: false });
  const current = useRef(loaded);
  useEffect(() => {
    let draft = emptyComparatorDraft();
    let stored = false;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) { draft = sanitizeComparatorDraft(JSON.parse(raw)); stored = true; }
      } catch { /* A blocked or malformed store must not break comparison. */ }
    }
    current.current = { key, draft, stored };
    setLoaded(current.current);
  }, [key]);

  const setDraft = useCallback((update: (draft: ComparatorDraft) => ComparatorDraft) => {
    if (!key || current.current.key !== key) return;
    const draft = update(current.current.draft);
    current.current = { key, draft, stored: current.current.stored };
    // Write at the action boundary, not an initial empty-state effect.
    try { localStorage.setItem(key, JSON.stringify(sanitizeComparatorDraft(draft))); } catch { /* Keep in-memory edits usable. */ }
    setLoaded(current.current);
  }, [key]);

  return { draft: loaded.key === key ? loaded.draft : emptyComparatorDraft(), setDraft, ready: !!key && loaded.key === key, hasStoredDraft: loaded.key === key && loaded.stored };
}