import { Copy, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface StudioInvitation {
  id: string; email: string; role: string; created_at: string; expires_at: string; accepted_at: string | null;
  status: "pending" | "accepted" | "failed"; email_status: string;
}

export function canResendInvitation(invite: StudioInvitation): boolean {
  return !invite.accepted_at && invite.status !== "accepted";
}

export function StudioInvitationList({ invites, loading, failed, sendingId, disabled, onRefresh, onResend, onCopy, onRevoke }: {
  invites: StudioInvitation[]; loading: boolean; failed: boolean; sendingId: string | null; disabled: boolean;
  onRefresh: () => void; onResend: (invite: StudioInvitation) => void; onCopy: (invite: StudioInvitation) => void; onRevoke: (id: string) => void;
}) {
  return <section aria-label="Studio member invitations" className="mt-6 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-display text-lg">Member invitations</h2><Button variant="ghost" size="icon" aria-label="Refresh invitations" title="Refresh invitations" disabled={loading} onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button></div>
    {failed ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Invitation statuses could not be loaded.</p><Button variant="outline" size="sm" onClick={onRefresh}>Try again</Button></div>
      : loading && invites.length === 0 ? <p role="status" className="text-sm text-muted-foreground">Loading invitations…</p>
      : invites.length === 0 ? <p className="text-sm text-muted-foreground">No invitations yet.</p>
      : <ul className="divide-y divide-border">{invites.map(inv => {
        const accepted = !canResendInvitation(inv);
        const expired = Date.parse(inv.expires_at) <= Date.now();
        return <li key={inv.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" data-invite-status={inv.status}>
          <div className="min-w-0"><p className="text-sm break-all">{inv.email}</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xs capitalize text-muted-foreground">{inv.role}</span><Badge variant={inv.status === "failed" ? "destructive" : "secondary"} className="capitalize">{inv.status}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{accepted ? `Accepted ${new Date(inv.accepted_at || inv.created_at).toLocaleDateString("en-GB")}` : inv.status === "failed" ? (inv.email_status === "not_sent" ? "Email has not been sent." : "Invitation email could not be sent.") : inv.email_status === "sent" ? "Email sent · Awaiting acceptance" : "Email queued · Awaiting acceptance"}{!accepted && expired ? " · Link expired" : ""}</p></div>
          {!accepted && <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" title="Copy invitation link" disabled={expired} onClick={() => onCopy(inv)}><Copy className="h-4 w-4 mr-2" />Copy link</Button><Button variant="outline" size="sm" disabled={disabled || sendingId !== null} onClick={() => onResend(inv)}><Mail className="h-4 w-4 mr-2" />{sendingId === inv.id ? "Sending…" : inv.status === "failed" ? "Resend failed invitation" : "Resend invite"}</Button><Button variant="ghost" size="sm" disabled={sendingId !== null} onClick={() => onRevoke(inv.id)}>Revoke</Button></div>}
        </li>;
      })}</ul>}
  </section>;
}