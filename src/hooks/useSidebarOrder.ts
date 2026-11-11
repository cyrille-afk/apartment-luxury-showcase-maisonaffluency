import { useCallback, useEffect, useState } from "react";
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
    window.addEventListener("storage", changed);
    window.addEventListener(SIDEBAR_ORDER_EVENT, changed);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener(SIDEBAR_ORDER_EVENT, changed); };
  }, [key, tipKey]);
  const order = saved?.key === key ? saved.order : DEFAULT_SIDEBAR_ORDER;
  const update = useCallback((change: Partial<SidebarOrder>) => {
    const next = { ...order, ...change };
    setSaved({ key, order: next });
    setTipState({ key, dismissed: true });
    try { localStorage.setItem(key, JSON.stringify(next)); localStorage.setItem(tipKey, "true"); window.dispatchEvent(new CustomEvent(SIDEBAR_ORDER_EVENT, { detail: key })); } catch { /* Session ordering still works when storage is blocked. */ }
  }, [key, tipKey, order]);
  return { order, update, showReorderTip: tipState?.key === key && !tipState.dismissed };
}