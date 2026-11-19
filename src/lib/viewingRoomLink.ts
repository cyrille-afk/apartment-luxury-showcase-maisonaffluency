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