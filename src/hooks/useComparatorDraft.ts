import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { comparatorDraftKey, emptyComparatorDraft, sanitizeComparatorDraft, type ComparatorDraft } from "@/lib/comparatorDraft";

const stampKey = (key: string) => `${key}:updated`;

/**
 * Comparator working draft: written to this browser immediately and mirrored
 * (price-free, sanitised) to the account so the same selection opens on
 * phone and desktop. The newer of the two copies wins on load.
 */
export function useComparatorDraft(userId: string | undefined, shortlistId: string | null) {
  const key = userId ? comparatorDraftKey(userId, shortlistId) : null;
  const remoteKey = shortlistId || "working";
  const [loaded, setLoaded] = useState<{ key: string | null; draft: ComparatorDraft; stored: boolean }>({ key: null, draft: emptyComparatorDraft(), stored: false });
  const current = useRef(loaded);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let draft = emptyComparatorDraft();
    let stored = false;
    let localStamp = 0;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) { draft = sanitizeComparatorDraft(JSON.parse(raw)); stored = true; }
        localStamp = Number(localStorage.getItem(stampKey(key)) || 0);
      } catch { /* A blocked or malformed store must not break comparison. */ }
    }
    if (!key || !userId) {
      current.current = { key, draft, stored };
      setLoaded(current.current);
      return;
    }
    // Wait for the account copy so another device's selection isn't hidden.
    void (async () => {
      try {
        const { data } = await supabase.from("comparator_working_drafts").select("draft, updated_at").eq("user_id", userId).eq("draft_key", remoteKey).maybeSingle();
        const remoteStamp = data ? Date.parse(data.updated_at) : 0;
        if (data && remoteStamp > localStamp) {
          draft = sanitizeComparatorDraft(data.draft);
          stored = true;
          try { localStorage.setItem(key, JSON.stringify(draft)); localStorage.setItem(stampKey(key), String(remoteStamp)); } catch { /* ignore */ }
        }
      } catch { /* Offline: keep this device's copy. */ }
      if (cancelled) return;
      current.current = { key, draft, stored };
      setLoaded(current.current);
    })();
    return () => { cancelled = true; };
  }, [key, userId, remoteKey]);

  const setDraft = useCallback((update: (draft: ComparatorDraft) => ComparatorDraft) => {
    if (!key || !userId || current.current.key !== key) return;
    const draft = update(current.current.draft);
    current.current = { key, draft, stored: current.current.stored };
    const clean = sanitizeComparatorDraft(draft);
    const now = Date.now();
    // Write at the action boundary, not an initial empty-state effect.
    try { localStorage.setItem(key, JSON.stringify(clean)); localStorage.setItem(stampKey(key), String(now)); } catch { /* Keep in-memory edits usable. */ }
    setLoaded(current.current);
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void supabase.from("comparator_working_drafts").upsert({ user_id: userId, draft_key: remoteKey, draft: clean as never, updated_at: new Date(now).toISOString() }).then(() => undefined, () => undefined);
    }, 600);
  }, [key, userId, remoteKey]);

  return { draft: loaded.key === key ? loaded.draft : emptyComparatorDraft(), setDraft, ready: !!key && loaded.key === key, hasStoredDraft: loaded.key === key && loaded.stored };
}
