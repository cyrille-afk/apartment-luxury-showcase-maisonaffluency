import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "trade:lastProjectFilter";

/**
 * Persists the `?project=` URL filter across navigation between
 * project hub, quotes, boards, tearsheets, and FF&E.
 *
 * - If the URL contains `?project=`, it is stored and used.
 * - If the URL has no `project` param on mount, the last stored value
 *   is restored into the URL (replace, no history entry).
 * - Clearing the filter (removing the param) also clears storage.
 */
export function useProjectFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = searchParams.get("project");
  const [restored, setRestored] = useState(false);

  // On mount: if no URL param, restore from session storage.
  useEffect(() => {
    if (restored) return;
    setRestored(true);
    if (urlValue) {
      try { sessionStorage.setItem(STORAGE_KEY, urlValue); } catch {}
      return;
    }
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(STORAGE_KEY); } catch {}
    if (stored) {
      const next = new URLSearchParams(searchParams);
      next.set("project", stored);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep storage in sync with URL changes after mount.
  useEffect(() => {
    if (!restored) return;
    try {
      if (urlValue) sessionStorage.setItem(STORAGE_KEY, urlValue);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [urlValue, restored]);

  const clear = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    setSearchParams(next, { replace: true });
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { projectFilter: urlValue, clearProjectFilter: clear, searchParams, setSearchParams };
}
