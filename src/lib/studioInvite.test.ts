import { describe, expect, it } from 'vitest'
import { canSendStudioInvite, studioInviteKey } from '../../supabase/functions/send-transactional-email/studioInvite'

describe('studio invitation sending', () => {
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
})