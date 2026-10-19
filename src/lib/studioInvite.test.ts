import { describe, expect, it } from 'vitest'
import { canSendStudioInvite, studioInviteKey } from '../../supabase/functions/send-transactional-email/studioInvite'
import { studioInvitationLink } from './studioInvitationLink'

describe('studio invitation sending', () => {
  it('shares the canonical sign-in URL with the exact invitation preserved after login', () => {
    const url = new URL(studioInvitationLink('invite-greg-1'));
    expect(url.origin).toBe('https://www.maisonaffluency.com');
    expect(url.pathname).toBe('/trade/login');
    expect(url.searchParams.get('next')).toBe('/trade/me?studioInvite=invite-greg-1');
  })
  it('allows studio owners and admins to send pending teammate invitations', () => {
    expect(canSendStudioInvite({ accepted_at: null, role: 'editor' }, 'owner')).toBe(true)
    expect(canSendStudioInvite({ accepted_at: null, role: 'viewer' }, 'admin')).toBe(true)
  })
  it('denies non-managers, missing and accepted invitations', () => {
    for (const role of [null, 'editor', 'viewer']) expect(canSendStudioInvite({ accepted_at: null, role: 'editor' }, role)).toBe(false)
    expect(canSendStudioInvite(null, 'owner')).toBe(false)
    expect(canSendStudioInvite({ accepted_at: '2026-10-19', role: 'editor' }, 'owner')).toBe(false)
  })
  it('only studio owners can send owner-role invitations', () => {
    expect(canSendStudioInvite({ accepted_at: null, role: 'owner' }, 'admin')).toBe(false)
    expect(canSendStudioInvite({ accepted_at: null, role: 'owner' }, 'owner')).toBe(true)
  })
  it('keeps retries identical and deliberate resends distinct', () => {
    expect(studioInviteKey('invite-1', 'attempt-1')).toBe('studio-invite-invite-1-attempt-1')
    expect(studioInviteKey('invite-1', 'attempt-2')).not.toBe(studioInviteKey('invite-1', 'attempt-1'))
  })
  it('allows verified platform admins to resend pending teammate invites without workspace membership', () => {
    expect(canSendStudioInvite({ accepted_at: null, role: 'editor' }, null, true)).toBe(true)
    expect(canSendStudioInvite({ accepted_at: null, role: 'editor' }, null, false)).toBe(false)
  })
  it('never lets platform admin resends bypass acceptance or owner-role protection', () => {
    expect(canSendStudioInvite({ accepted_at: '2026-10-19', role: 'editor' }, null, true)).toBe(false)
    expect(canSendStudioInvite({ accepted_at: null, role: 'owner' }, null, true)).toBe(false)
  })
})
import { inviteLinkGuidance } from './studioInvitationLink';
describe('inviteLinkGuidance', () => {
  it('pending links need no guidance', () => expect(inviteLinkGuidance('pending', 'A')).toBeNull());
  it('expired links ask for a resend', () => expect(inviteLinkGuidance('expired', 'A')!.title).toBe('This invitation has expired'));
  it('used links tell existing members they already joined', () => expect(inviteLinkGuidance('accepted', 'A', true)!.action).toBe('studio'));
  it('used links for removed members ask for a new invite', () => expect(inviteLinkGuidance('accepted', 'A', false)!.title).toBe('This invitation has already been used'));
  it('revoked or other-account links share one message', () => expect(inviteLinkGuidance('unavailable')!.title).toBe('This invitation is no longer available'));
});
