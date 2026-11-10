export type InvitationEmailStatus = { invite_id: string; email_status: string; updated_at: string | null };

/** Re-inviting must display the newest attempt, independently of joined/viewed membership. */
export function latestInvitationEmail(ids: string[], statuses: InvitationEmailStatus[]) {
  return statuses.filter(row => ids.includes(row.invite_id)).sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
}

export function invitationEmailState(status?: string) {
  switch (status) {
    case "delivered": return { status: "delivered", label: "Email delivered", tone: "text-primary", detail: "Delivery confirmed by the email service." };
    case "sent": return { status: "sent", label: "Email sent", tone: "text-muted-foreground", detail: "Accepted for sending; inbox delivery is not confirmed." };
    case "pending": return { status: "pending", label: "Email pending", tone: "text-muted-foreground", detail: "Queued for sending." };
    case "bounced": return { status: "bounced", label: "Email bounced", tone: "text-destructive", detail: "The recipient’s email server rejected this email." };
    case "dlq": case "failed": return { status: "failed", label: "Email failed", tone: "text-destructive", detail: "The invitation exists, but its email could not be sent." };
    case "suppressed": case "complained": return { status: "blocked", label: "Email blocked", tone: "text-destructive", detail: "Email sending to this recipient is blocked." };
    default: return { status: "unconfirmed", label: "Email unconfirmed", tone: "text-muted-foreground", detail: "No confirmed email status is available." };
  }
}