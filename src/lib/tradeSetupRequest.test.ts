import { describe, expect, it } from 'vitest';
import { eligibleForSetupRequest, PASSWORD_LINK_VALIDITY_HOURS } from './tradeSetupRequest';

describe('Password setup request rules', () => {
  it('uses the confirmed 24-hour global password-link validity', () => {
    expect(PASSWORD_LINK_VALIDITY_HOURS).toBe(24);
  });
  it('allows approved studios still awaiting activation', () => {
    expect(eligibleForSetupRequest({ status: 'approved', user_id: null })).toBe(true);
  });
  it('never reactivates rejected or unapproved studios', () => {
    for (const status of ['rejected', 'pending_review', 'on_hold']) {
      expect(eligibleForSetupRequest({ status, user_id: null })).toBe(false);
    }
  });
  it('does not send setup emails for linked accounts or unknown emails', () => {
    expect(eligibleForSetupRequest({ status: 'approved', user_id: 'linked-user' })).toBe(false);
    expect(eligibleForSetupRequest(null)).toBe(false);
  });
});