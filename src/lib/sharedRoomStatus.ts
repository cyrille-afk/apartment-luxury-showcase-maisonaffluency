export type RoomDecisionItem = { id: string; approval_status: string; product_name: string };
export type RoomDecisionInvite = { id: string; email: string; role: string; status: string; expires_at: string; last_seen_at: string | null };
export type RoomDecisionFeedback = { item_id: string; invite_id: string | null; comment: string | null; reaction: string | null; created_at: string };
export function sharedRoomStatus(items: RoomDecisionItem[], invites: RoomDecisionInvite[], feedback: RoomDecisionFeedback[], now: number) {
  const clients = invites.filter(i => i.role === "client" && i.status !== "revoked");
  const activeClients = clients.filter(i => new Date(i.expires_at).getTime() > now);
  const clientIds = new Set(clients.map(i => i.id));
  const clientFeedback = feedback.filter(f => f.invite_id && clientIds.has(f.invite_id)).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const decisions = items.filter(i => i.approval_status !== "approved").map(item => {
    const finish = clientFeedback.find(f => f.item_id === item.id && f.comment?.startsWith("Finish request: "));
    const latest = clientFeedback.find(f => f.item_id === item.id && f.comment);
    return { ...item, kind: finish ? "Finish change requested" : item.approval_status === "rejected" ? "Reselection requested" : "Awaiting client decision", comment: finish?.comment?.slice(16) ?? latest?.comment ?? null };
  });
  const approved = items.filter(i => i.approval_status === "approved").length;
  const attention = decisions.filter(d => d.kind !== "Awaiting client decision").length;
  const status = !clients.length ? "Not invited" : items.length > 0 && approved === items.length ? "Approved" : attention > 0 ? "Changes requested" : !activeClients.length ? "Invitation expired" : approved > 0 ? "Partially approved" : "Awaiting client";
  return { status, approved, total: items.length, pending: decisions.length, attention, decisions, clients, lastSeen: clients.map(i=>i.last_seen_at).filter((s): s is string => Boolean(s)).sort().at(-1) ?? null };
}