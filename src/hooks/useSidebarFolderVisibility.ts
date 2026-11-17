import { useCallback, useEffect, useState } from "react";

const CHANGE_EVENT = "ma:sidebar-folder-visibility";

/** Device-local, account-scoped; showing empties preserves existing navigation. */
export function useSidebarFolderVisibility(userId?: string) {
  const key = `ma-sidebar-show-empty-v1:${userId ?? "guest"}`;
  const [saved, setSaved] = useState<{ key: string; value: boolean } | null>(null);
  useEffect(() => {
    const read = () => {
      try { setSaved({ key, value: localStorage.getItem(key) !== "false" }); }
      catch { setSaved({ key, value: true }); }
    };
    const changed = (event: Event) => {
      if (event instanceof StorageEvent ? event.key === key || event.key === null : (event as CustomEvent).detail?.key === key) {
        if (event instanceof CustomEvent && typeof event.detail?.value === "boolean") setSaved({ key, value: event.detail.value });
        else read();
      }
    };
    read();
    window.addEventListener(CHANGE_EVENT, changed);
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener(CHANGE_EVENT, changed); window.removeEventListener("storage", changed); };
  }, [key]);
  const setShowEmptyFolders = useCallback((value: boolean) => {
    setSaved({ key, value });
    try { localStorage.setItem(key, String(value)); } catch { /* Keep the session preference. */ }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key, value } }));
  }, [key]);
  return { showEmptyFolders: saved?.key === key ? saved.value : true, setShowEmptyFolders };
}

export function sidebarFolderLinks<T extends { item_count?: number }>(boards: T[], showEmptyFolders: boolean): T[] {
  return showEmptyFolders ? boards : boards.filter(board => board.item_count !== 0);
}