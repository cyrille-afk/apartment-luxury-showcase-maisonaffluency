import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateTradeApplication, declineAndDeleteTradeApplication, resendTradeActivation } from './tradeApplicationActions';

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
  it('resends activation with a fresh key without changing approval', async () => {
    const draft = { subject: 'Welcome', body: 'Dear Jane,' };
    await resendTradeActivation({ ...account, status: 'approved' }, draft, 'new-attempt');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls[0][1].body.idempotencyKey).toBe('trade-approval-application-1-new-attempt');
    expect(mocks.invoke.mock.calls[1][1].body.idempotencyKey).toBe('trade-approval-copy-concierge-application-1-new-attempt');
  });
  it('retains the same resend key on retry and reports sending failure', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('offline') });
    const draft = { subject: 'Welcome', body: 'Dear Jane,' };
    for (let i = 0; i < 2; i++) await expect(resendTradeActivation({ ...account, status: 'approved' }, draft, 'retry-attempt')).resolves.toEqual({ notified: false });
    expect(mocks.invoke.mock.calls.every(c => c[1].body.idempotencyKey === 'trade-approval-application-1-retry-attempt')).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('blocks resend for unapproved applicants', async () => {
    await expect(resendTradeActivation(account, { subject: 'Welcome', body: 'Dear Jane,' }, 'attempt')).rejects.toThrow('Only approved');
    expect(mocks.invoke).not.toHaveBeenCalled();
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
  it('sends an exact copy of the applicant letter to each admin mailbox', async () => {
    await updateTradeApplication(account, 'approved', { subject: 'Welcome, Atelier', body: 'Dear Jane,\n\nPersonal note.' });
    const [main, ...copies] = mocks.invoke.mock.calls.map((c) => c[1].body);
    expect(copies.map((b) => b.templateName)).toEqual(['trade-approval-copy-concierge', 'trade-approval-copy-cyrille']);
    expect(copies.every((b) => !('recipientEmail' in b))).toBe(true);
    expect(copies[0].idempotencyKey).toBe('trade-approval-copy-concierge-application-1');
    copies.forEach((b) => expect(b.templateData).toEqual(main.templateData));
  });
  it('copies decline letters with the rejection template', async () => {
    await declineAndDeleteTradeApplication(account);
    expect(mocks.invoke.mock.calls.slice(1).map((c) => c[1].body.templateName)).toEqual(['trade-rejection-copy-concierge', 'trade-rejection-copy-cyrille']);
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