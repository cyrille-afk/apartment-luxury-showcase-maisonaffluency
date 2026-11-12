import { useCallback, useEffect, useState } from "react";
import { fetchRemoteSidebarOrder, isCustomOrder, saveRemoteSidebarOrder } from "@/lib/sidebarOrderSync";
import { DEFAULT_SIDEBAR_ORDER, parseSidebarOrder, sidebarOrderKey, SIDEBAR_ORDER_EVENT, type SidebarOrder } from "@/lib/sidebarOrder";

export function useSidebarOrder(userId?: string) {
  const key = sidebarOrderKey(userId);
  const tipKey = `${key}:reordered`;
  const [tipState, setTipState] = useState<{ key: string; dismissed: boolean } | null>(null);
  const [saved, setSaved] = useState<{ key: string; order: SidebarOrder } | null>(null);
  useEffect(() => {
    const read = () => { try { setSaved({ key, order: parseSidebarOrder(localStorage.getItem(key)) }); setTipState({ key, dismissed: localStorage.getItem(tipKey) === "true" }); } catch { setSaved({ key, order: DEFAULT_SIDEBAR_ORDER }); setTipState({ key, dismissed: false }); } };
    const changed = (event: Event) => {
      if (event instanceof StorageEvent ? event.key === key || event.key === tipKey || event.key === null : (event as CustomEvent).detail === key) read();
    };
    read();
    let cancelled = false;
    // Account copy wins; if the account has none yet, upload this browser's saved layout (one-time migration).
    if (userId) fetchRemoteSidebarOrder(userId).then(remote => {
      if (cancelled) return;
      const local = parseSidebarOrder(localStorage.getItem(key));
      const localReordered = localStorage.getItem(tipKey) === "true";
      if (remote && isCustomOrder(remote.order)) {
        const order = parseSidebarOrder(JSON.stringify(remote.order));
        localStorage.setItem(key, JSON.stringify(order));
        if (remote.reordered) localStorage.setItem(tipKey, "true");
        setSaved({ key, order });
        setTipState({ key, dismissed: remote.reordered || localReordered });
      } else if (isCustomOrder(local) || (localReordered && !remote?.reordered)) {
        void saveRemoteSidebarOrder(userId, local, localReordered || !!remote?.reordered).catch(() => {});
      } else if (remote?.reordered) {
        localStorage.setItem(tipKey, "true");
        setTipState({ key, dismissed: true });
      }
    }).catch(() => { /* Offline: keep the browser copy. */ });
    window.addEventListener("storage", changed);
    window.addEventListener(SIDEBAR_ORDER_EVENT, changed);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener(SIDEBAR_ORDER_EVENT, changed); cancelled = true; };
  }, [key, tipKey, userId]);
  const order = saved?.key === key ? saved.order : DEFAULT_SIDEBAR_ORDER;
  const update = useCallback((change: Partial<SidebarOrder>) => {
    const next = { ...order, ...change };
    setSaved({ key, order: next });
    setTipState({ key, dismissed: true });
    try { localStorage.setItem(key, JSON.stringify(next)); localStorage.setItem(tipKey, "true"); window.dispatchEvent(new CustomEvent(SIDEBAR_ORDER_EVENT, { detail: key })); } catch { /* Session ordering still works when storage is blocked. */ }
    if (userId) void saveRemoteSidebarOrder(userId, next).catch(() => {});
  }, [key, tipKey, order, userId]);
  return { order, update, showReorderTip: tipState?.key === key && !tipState.dismissed };
}