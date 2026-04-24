import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "trade:lastProjectFilter";

/**
 * Single source of truth for the cross-page Trade filters:
 * - `?project=` — persisted in sessionStorage so it survives navigation.
 * - `?designer=` — URL-only (per-page filter selection).
 *
 * Used by: TradeProjectDetail, TradeQuotes, TradeBoards, TradeTearsheets.
 *
 * Mutations push history (back/forward navigates between filter states).
 * Initial sessionStorage hydration uses replace (no phantom history entry).
 */
export function useProjectFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get("project");
  const designerFilter = searchParams.get("designer");
  const [restored, setRestored] = useState(false);

  // On mount: if no URL `project` param, restore from session storage.
  useEffect(() => {
    if (restored) return;
    setRestored(true);
    if (projectFilter) {
      try { sessionStorage.setItem(STORAGE_KEY, projectFilter); } catch {}
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
      if (projectFilter) sessionStorage.setItem(STORAGE_KEY, projectFilter);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [projectFilter, restored]);

  const setProjectFilter = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("project", id); else next.delete("project");
    setSearchParams(next);
  };

  const setDesignerFilter = (name: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (name) next.set("designer", name); else next.delete("designer");
    setSearchParams(next);
  };

  const clearProjectFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    setSearchParams(next);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const clearDesignerFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("designer");
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    next.delete("designer");
    setSearchParams(next);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return {
    projectFilter,
    designerFilter,
    setProjectFilter,
    setDesignerFilter,
    clearProjectFilter,
    clearDesignerFilter,
    clearAllFilters,
    searchParams,
    setSearchParams,
  };
}
