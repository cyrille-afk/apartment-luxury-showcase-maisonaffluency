export type BoardInvitation = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  last_seen_at: string | null;
  view_only: boolean;
  role: string;
};

export function boardInvitationStatus(invite: Pick<BoardInvitation, "status" | "expires_at" | "last_seen_at">, now: number) {
  if (invite.status === "revoked") return { label: "Revoked", canView: false };
  const expiry = Date.parse(invite.expires_at);
  if (!Number.isFinite(expiry)) return { label: "Unconfirmed", canView: false };
  if (expiry <= now) return { label: "Expired", canView: false };
  return { label: invite.last_seen_at ? "Viewed" : invite.status === "accepted" ? "Accepted" : "Invited", canView: true };
}

export function boardInvitationPermission(invite: Pick<BoardInvitation, "view_only" | "role">) {
  return invite.view_only ? "View only" : invite.role === "contractor" ? "Can edit / add pieces" : "Can comment / approve";
}