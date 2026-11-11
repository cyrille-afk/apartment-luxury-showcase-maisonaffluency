export type SidebarOrder = { sections: string[]; projects: string[]; folders: Record<string, string[]> };
export const DEFAULT_SIDEBAR_ORDER: SidebarOrder = { sections: ["core", "tools", "quotes", "projects"], projects: [], folders: {} };
export const SIDEBAR_ORDER_EVENT = "trade-sidebar-order-changed";
export function sidebarOrderKey(userId?: string) { return `ma-sidebar-order-v1:${userId || "guest"}`; }
export function orderedSidebarItems<T extends { id: string }>(items: T[], order: string[]) {
  const byId = new Map(items.map(item => [item.id, item]));
  const ids = [...new Set([...order, ...items.map(item => item.id)])];
  return ids.flatMap(id => { const item = byId.get(id); return item ? [item] : []; });
}
export function parseSidebarOrder(raw: string | null): SidebarOrder {
  try {
    const value = JSON.parse(raw || "null");
    const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === "string"))] : [];
    return { sections: strings(value?.sections), projects: strings(value?.projects), folders: Object.fromEntries(Object.entries(value?.folders && typeof value.folders === "object" ? value.folders : {}).map(([id, order]) => [id, strings(order)])) };
  } catch { return { ...DEFAULT_SIDEBAR_ORDER }; }
}
export function resetSidebarOrder(userId?: string) {
  window.localStorage.removeItem(sidebarOrderKey(userId));
  window.dispatchEvent(new CustomEvent(SIDEBAR_ORDER_EVENT, { detail: sidebarOrderKey(userId) }));
}