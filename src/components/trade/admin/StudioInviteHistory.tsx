import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type InviteHistoryEvent = 'created' | 'sent' | 'resent' | 'accepted' | 'revoked' | 'expired';
interface Row { invite_id: string; email: string; role: string | null; event: InviteHistoryEvent; actor_name: string | null; occurred_at: string }

export const INVITE_EVENT_LABEL: Record<InviteHistoryEvent, string> = {
  created: 'Invitation created',
  sent: 'Invitation email sent',
  resent: 'Invitation email resent',
  accepted: 'Accepted — joined the studio',
  revoked: 'Revoked',
  expired: 'Expired',
};

const tone: Partial<Record<InviteHistoryEvent, string>> = { accepted: 'text-foreground', revoked: 'text-destructive', expired: 'text-destructive' };
const when = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));

export function StudioInviteHistory({ studioId, enabled }: { studioId: string; enabled: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-studio-detail', studioId, 'invite-history'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_studio_invite_history' as never, { _studio_id: studioId } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  return (
    <section aria-labelledby="studio-invite-history">
      <h2 id="studio-invite-history" className="mb-4 font-display text-xl text-foreground">Invitation activity</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : error ? <p className="text-sm text-destructive">Could not load invitation activity.</p>
        : !data?.length ? <p className="text-sm text-muted-foreground">No invitation activity yet.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-border text-xs text-muted-foreground"><tr>{['When (UTC)', 'Activity', 'Invitee', 'Role', 'By'].map(l => <th key={l} className="px-4 py-3 font-medium">{l}</th>)}</tr></thead>
            <tbody>{data.map((row, i) => (
              <tr key={`${row.invite_id}-${row.event}-${i}`} className="border-b border-border">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{when(row.occurred_at)}</td>
                <td className={`px-4 py-3 ${tone[row.event] ?? 'text-muted-foreground'}`}>{INVITE_EVENT_LABEL[row.event] ?? row.event}</td>
                <td className="px-4 py-3 text-foreground">{row.email}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{row.role ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.event === 'expired' ? '—' : row.actor_name ?? '—'}</td>
              </tr>))}</tbody>
          </table></div>}
    </section>
  );
}
