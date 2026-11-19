/** Names describe the room; the unchanged access token remains its credential. */
export function viewingRoomPath(name: string, token: string): string {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "private-residences";
  const label = /residences$/.test(slug) ? `${slug}-apartments` : slug;
  return `/viewing-room/${label}--${encodeURIComponent(token)}`;
}

export function viewingRoomAccessToken(locator: string): string {
  const divider = locator.lastIndexOf("--");
  return divider < 0 ? locator : locator.slice(divider + 2);
}
const RETURN_KEY = "ma-viewing-room-admin-return";
/** Admin preview only: remembers the same-origin admin page to return to; guests never have it. */
export function rememberViewingRoomReturn(path: string): void {
  try { if (path.startsWith("/trade/")) sessionStorage.setItem(RETURN_KEY, path); } catch { /* storage unavailable */ }
}
export function readViewingRoomReturn(): string | null {
  try { const v = sessionStorage.getItem(RETURN_KEY); return v && v.startsWith("/trade/") ? v : null; } catch { return null; }
}
