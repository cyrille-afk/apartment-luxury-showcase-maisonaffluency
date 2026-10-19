const INVITATION_ORIGIN = 'https://www.maisonaffluency.com';

export function studioInvitationLink(inviteId: string): string {
  const destination = `/trade/me?studioInvite=${encodeURIComponent(inviteId)}`;
  const url = new URL('/trade/login', INVITATION_ORIGIN);
  url.searchParams.set('next', destination);
  return url.toString();
}
export type InviteLinkStatus = 'pending' | 'expired' | 'accepted' | 'unavailable';

export interface InviteLinkGuidance { title: string; body: string; action?: 'studio' }

/** Recipient-facing guidance for an invitation link that can't be accepted. */
export function inviteLinkGuidance(status: InviteLinkStatus, studioName?: string | null, isMember = false): InviteLinkGuidance | null {
  const studio = studioName || 'this studio';
  if (status === 'pending') return null;
  if (status === 'expired') return {
    title: 'This invitation has expired',
    body: `Invitation links stay valid for 14 days. Ask the owner of ${studio} to resend your invitation — the new email will contain a fresh link.`,
  };
  if (status === 'accepted') return isMember
    ? { title: 'You have already joined', body: `This invitation was already used, and you're a member of ${studio}. Select it from the studio switcher at the top of the page.`, action: 'studio' }
    : { title: 'This invitation has already been used', body: `It was accepted earlier, but you're no longer a member of ${studio}. Ask the studio owner to send you a new invitation.` };
  return {
    title: 'This invitation is no longer available',
    body: 'It may have been revoked by the studio, or it was sent to a different email address. Check you are signed in with the email the invitation was sent to, or ask the studio owner for a new invitation.',
  };
}
