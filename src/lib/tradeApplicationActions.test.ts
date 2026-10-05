import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateTradeApplication, declineAndDeleteTradeApplication } from './tradeApplicationActions';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), single: vi.fn(), update: vi.fn(), remove: vi.fn(), events: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'reviewer' } } } })) },
  functions: { invoke: (...args: unknown[]) => { mocks.events.push('email'); return mocks.invoke(...args); } },
  from: () => ({
    update: (data: unknown) => { mocks.events.push('update'); mocks.update(data); return chain; },
    delete: () => { mocks.events.push('delete'); mocks.remove(); return chain; },
  }),
} }));
const chain = { eq: () => chain, select: () => chain, single: () => mocks.single() };
const account = { id: 'application-1', email: 'applicant@example.com', contact_name: 'Jane Smith', studio_name: 'Atelier', status: 'pending_review' as const };

describe('Trade application notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.events.length = 0;
    mocks.single.mockResolvedValue({ data: { id: account.id }, error: null });
    mocks.invoke.mockResolvedValue({ data: { success: true, queued: true }, error: null });
  });
  it('persists approval before sending the registered personalised template', async () => {
    await expect(updateTradeApplication(account, 'approved')).resolves.toEqual({ notified: true });
    expect(mocks.events).toEqual(['update', 'email', 'email', 'email']);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', reviewed_by: 'reviewer' }));
    expect(mocks.invoke).toHaveBeenCalledWith('send-transactional-email', { body: {
      templateName: 'trade-approval', recipientEmail: account.email, idempotencyKey: 'trade-approval-application-1',
      templateData: { name: 'Jane Smith', companyName: 'Atelier' },
    } });
  });
  it('records rejection and queues the editorial decline before deleting', async () => {
    await declineAndDeleteTradeApplication(account);
    expect(mocks.events).toEqual(['update', 'email', 'email', 'email', 'delete']);
    expect(mocks.invoke.mock.calls[0][1].body.templateName).toBe('trade-rejection');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
  });
  it('never emails or deletes when saving fails', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(declineAndDeleteTradeApplication(account)).rejects.toThrow('Could not update');
    expect(mocks.invoke).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('preserves an approved state if email queuing fails', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('offline') });
    await expect(updateTradeApplication(account, 'approved')).resolves.toEqual({ notified: false });
    expect(mocks.update).toHaveBeenCalled();
  });
  it('keeps the rejected application for retry when the notice fails or is suppressed', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: false, reason: 'email_suppressed' }, error: null });
    await expect(declineAndDeleteTradeApplication(account)).rejects.toThrow('record was kept');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('sends a separate internal alert to each admin mailbox after the applicant notice', async () => {
    await updateTradeApplication(account, 'approved');
    const alerts = mocks.invoke.mock.calls.slice(1).map((c) => c[1].body);
    expect(alerts.map((b) => b.templateName)).toEqual(['application-decision-alert-concierge', 'application-decision-alert-cyrille']);
    expect(alerts.every((b) => !('recipientEmail' in b))).toBe(true);
    expect(alerts[0].idempotencyKey).toBe('application-decision-alert-concierge-approved-application-1');
    expect(alerts[0].templateData).toMatchObject({ decision: 'approved', applicantEmail: account.email, companyName: 'Atelier' });
  });
  it('sends no admin alert when the applicant notice fails', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('offline') });
    await updateTradeApplication(account, 'approved');
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it('does not send on hold or repeat approval', async () => {
    await updateTradeApplication(account, 'on_hold');
    await updateTradeApplication({ ...account, status: 'approved' }, 'approved');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('retries a retained rejection with the same email idempotency key', async () => {
    await declineAndDeleteTradeApplication({ ...account, status: 'rejected' });
    expect(mocks.events).toEqual(['update', 'email', 'email', 'email', 'delete']);
    expect(mocks.invoke.mock.calls[0][1].body.idempotencyKey).toBe('trade-rejection-application-1');
  });
  it('sends edited copy through escaped template props only after persisting', async () => {
    await updateTradeApplication(account, 'approved', { subject: 'Welcome, Atelier', body: 'Dear Jane,\n\nA personal welcome.' });
    expect(mocks.events).toEqual(['update', 'email', 'email', 'email']);
    expect(mocks.invoke.mock.calls[0][1].body.templateData).toEqual({ name: 'Jane Smith', companyName: 'Atelier', subjectText: 'Welcome, Atelier', bodyText: 'Dear Jane,\n\nA personal welcome.' });
  });
  it('rejects empty drafts before changing any application record', async () => {
    await expect(updateTradeApplication(account, 'approved', { subject: '', body: '' })).rejects.toThrow('valid subject');
    expect(mocks.events).toEqual([]);
  });
  it('retries an approved notification with the same draft and stable key', async () => {
    await updateTradeApplication({ ...account, status: 'approved' }, 'approved', { subject: 'Welcome', body: 'Dear Jane,' });
    expect(mocks.invoke.mock.calls[0][1].body.idempotencyKey).toBe('trade-approval-application-1');
  });
});