/** Branded locators describe rooms, never authorize them. */
export function viewingRoomPath(name: string): string {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "private-residences";
  const label = /residences$/.test(slug) ? `${slug}-apartments` : slug;
  return `/viewing-room/${label}`;
}

export function isLegacyViewingRoomLink(locator: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(viewingRoomAccessToken(locator));
}
export function viewingRoomCookieName(locator: string): string {
  return `ma_viewing_room_${locator}`;
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

export function isShortViewingRoomCode(code: string): boolean { return /^[A-Z0-9]{3}-[A-Z0-9]{4}$/i.test(code.trim()); }
export function shortViewingRoomPath(code: string): string { return `/r/${code.trim().toUpperCase()}`; }
