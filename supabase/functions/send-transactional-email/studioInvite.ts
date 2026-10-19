export function canSendStudioInvite(invite: { accepted_at: string | null; role: string } | null, memberRole: string | null): boolean {
  return !!invite && !invite.accepted_at && (memberRole === 'owner' || (memberRole === 'admin' && invite.role !== 'owner'))
}

export function studioInviteKey(inviteId: string, attemptId: string): string {
  return `studio-invite-${inviteId}-${attemptId}`
}