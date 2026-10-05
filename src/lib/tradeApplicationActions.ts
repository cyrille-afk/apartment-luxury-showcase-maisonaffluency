import { supabase } from '@/integrations/supabase/client';

export type ApplicationStatus = 'pending_review' | 'on_hold' | 'approved' | 'rejected';
export type ApplicationRecord = {
  id: string;
  email: string;
  contact_name: string | null;
  studio_name: string | null;
  status: ApplicationStatus;
};

async function notifyApplication(a: ApplicationRecord, status: 'approved' | 'rejected') {
  const templateName = status === 'approved' ? 'trade-approval' : 'trade-rejection';
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: a.email,
        idempotencyKey: `${templateName}-${a.id}`,
        templateData: { name: a.contact_name ?? undefined, companyName: a.studio_name ?? undefined },
      },
    });
    if (error || data?.success !== true) return false;
    return true;
  } catch {
    return false;
  }
}

export async function updateTradeApplication(a: ApplicationRecord, status: ApplicationStatus) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user.id) throw new Error('Please sign in again before reviewing an application.');
  const { data, error } = await supabase.from('trade_accounts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: session.session.user.id })
    .eq('id', a.id).select('id').single();
  if (error || !data) throw new Error('Could not update the application.');
  if ((status === 'approved' || status === 'rejected') && a.status !== status) {
    return { notified: await notifyApplication(a, status) };
  }
  return { notified: null };
}

export async function declineAndDeleteTradeApplication(a: ApplicationRecord) {
  // Save the review before notifying; retain the rejected row if queuing fails.
  const result = await updateTradeApplication(a, 'rejected');
  const notified = result.notified ?? await notifyApplication(a, 'rejected');
  if (!notified) throw new Error('Application rejected, but the email could not be queued. The record was kept so you can retry.');
  const { data, error } = await supabase.from('trade_accounts').delete().eq('id', a.id).select('id').single();
  if (error || !data) throw new Error('The decline email was queued, but the application could not be deleted.');
}