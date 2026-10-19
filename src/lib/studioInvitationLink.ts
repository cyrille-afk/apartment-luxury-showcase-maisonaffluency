const INVITATION_ORIGIN = 'https://www.maisonaffluency.com';

export function studioInvitationLink(inviteId: string): string {
  const destination = `/trade/me?studioInvite=${encodeURIComponent(inviteId)}`;
  const url = new URL('/trade/login', INVITATION_ORIGIN);
  url.searchParams.set('next', destination);
  return url.toString();
}