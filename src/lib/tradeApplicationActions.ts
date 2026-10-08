import { supabase } from '@/integrations/supabase/client';
import type { NotificationDraft } from '../../supabase/functions/_shared/applicationNotificationCopy';

export type ApplicationStatus = 'pending_review' | 'on_hold' | 'approved' | 'rejected';
export type ApplicationRecord = {
  id: string;
  email: string;
  contact_name: string | null;
  studio_name: string | null;
  country?: string | null;
  status: ApplicationStatus;
};

/** Exact copy of the applicant's letter to each admin mailbox (one recipient per send). Never blocks the applicant notice. */
async function copyAdmins(a: ApplicationRecord, base: string, templateData: Record<string, unknown>, attempt?: string) {
  await Promise.all(['concierge', 'cyrille', 'gregoire'].map((who) => {
    const templateName = `${base}-copy-${who}`;
    return supabase.functions.invoke('send-transactional-email', {
      body: { templateName, idempotencyKey: `${templateName}-${a.id}${attempt ? `-${attempt}` : ''}`, templateData },
    }).catch(() => null);
  }));
}

async function notifyApplication(a: ApplicationRecord, status: 'approved' | 'rejected', draft?: NotificationDraft, attempt?: string) {
  const templateName = status === 'approved' ? 'trade-approval' : 'trade-rejection';
  try {
    const templateData = { name: a.contact_name ?? undefined, companyName: a.studio_name ?? undefined, country: a.country ?? undefined,
      ...(draft ? { subjectText: draft.subject, bodyText: draft.body } : {}) };
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: { templateName, recipientEmail: a.email, idempotencyKey: `${templateName}-${a.id}${attempt ? `-${attempt}` : ''}`, templateData },
    });
    if (error || data?.success !== true) return false;
    await copyAdmins(a, templateName, templateData, attempt);
    return true;
  } catch {
    return false;
  }
}

export async function resendTradeActivation(a: ApplicationRecord, draft: NotificationDraft, attempt: string) {
  if (a.status !== 'approved') throw new Error('Only approved studios can receive activation access.');
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(attempt) || !draft.subject.trim() || draft.subject.length > 200 || /[\r\n]/.test(draft.subject) || !draft.body.trim() || draft.body.length > 20000) throw new Error('Please provide a valid activation email.');
  return { notified: await notifyApplication(a, 'approved', draft, attempt) };
}

export async function updateTradeApplication(a: ApplicationRecord, status: ApplicationStatus, draft?: NotificationDraft) {
  if (draft && (!draft.subject.trim() || draft.subject.length > 200 || /[\r\n]/.test(draft.subject) || !draft.body.trim() || draft.body.length > 20000)) {
    throw new Error('Please provide a valid subject and email body.');
  }
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user.id) throw new Error('Please sign in again before reviewing an application.');
  const { data, error } = await supabase.from('trade_accounts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: session.session.user.id })
    .eq('id', a.id).select('id').single();
  if (error || !data) throw new Error('Could not update the application.');
  if ((status === 'approved' || status === 'rejected') && (a.status !== status || draft)) {
    return { notified: await notifyApplication(a, status, draft) };
  }
  return { notified: null };
}

export async function declineAndDeleteTradeApplication(a: ApplicationRecord, draft?: NotificationDraft) {
  // Save the review before notifying; retain the rejected row if queuing fails.
  const result = await updateTradeApplication(a, 'rejected', draft);
  const notified = result.notified ?? await notifyApplication(a, 'rejected', draft);
  if (!notified) throw new Error('Application rejected, but the email could not be queued. The record was kept so you can retry.');
  const { data, error } = await supabase.from('trade_accounts').delete().eq('id', a.id).select('id').single();
  if (error || !data) throw new Error('The decline email was queued, but the application could not be deleted.');
}