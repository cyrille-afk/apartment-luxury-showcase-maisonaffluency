export type CollaboratorInvite = { id: string; email: string; status?: string | null; last_seen_at?: string | null; created_at?: string | null };

const rank = (i: CollaboratorInvite) => (i.status === "accepted" || i.status === "joined" ? 2 : i.last_seen_at ? 1 : 0);

/** One entry per email (case-insensitive); joined beats viewed beats pending, newest wins ties. `ids` holds every invite for that email. */
export function uniqueCollaborators<T extends CollaboratorInvite>(invites: T[]): (T & { ids: string[] })[] {
  const byEmail = new Map<string, T & { ids: string[] }>();
  for (const inv of invites) {
    const key = inv.email.trim().toLowerCase();
    const cur = byEmail.get(key);
    if (!cur) { byEmail.set(key, { ...inv, ids: [inv.id] }); continue; }
    const ids = [...cur.ids, inv.id];
    const better = rank(inv) > rank(cur) || (rank(inv) === rank(cur) && (inv.created_at ?? "") > (cur.created_at ?? ""));
    byEmail.set(key, better ? { ...inv, ids } : { ...cur, ids });
  }
  return [...byEmail.values()];
}
