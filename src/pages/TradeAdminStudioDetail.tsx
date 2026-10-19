import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

interface StudioDetails {
  studio: { id: string; name: string; display_name: string | null; billing_email: string | null; created_at: string };
  members: { id: string; name: string; email: string | null; role: MemberRole; joined_at: string }[];
  invitations: { id: string; email: string; role: string; created_at: string; expires_at: string; expired: boolean }[];
}
const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

export default function TradeAdminStudioDetail() {
  const { studioId } = useParams();
  const { user, rolesLoaded, isAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState<{ member: StudioDetails['members'][number]; role?: Exclude<MemberRole, 'owner'> } | null>(null);
  const [actionError, setActionError] = useState('');
  const enabled = Boolean(user && rolesLoaded && (isAdmin || isSuperAdmin) && studioId);
  const query = useQuery({
    queryKey: ['admin-studio-detail', user?.id, studioId], enabled,
    queryFn: async () => {
      if (!studioId) return null;
      const { data, error } = await supabase.rpc('admin_studio_details', { _studio_id: studioId });
      if (error) throw error;
      return data as unknown as StudioDetails | null;
    },
  });
  const data = enabled ? query.data : undefined;
  const mutation = useMutation({
    mutationFn: async (change: NonNullable<typeof pending>) => {
      if (!enabled || !studioId) throw new Error('Administrator access required.');
      const { error } = await supabase.rpc('admin_manage_studio_member', {
        _studio_id: studioId, _member_id: change.member.id,
        _action: change.role ? 'change_role' : 'remove',
        _expected_role: change.member.role, _role: change.role,
      });
      if (error) throw error;
    },
    onSuccess: async (_, change) => {
      setPending(null);
      setActionError('');
      toast({ title: change.role ? 'Member role updated' : 'Member removed' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-studio-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-studios'] }),
        queryClient.invalidateQueries({ queryKey: ['studios'] }),
      ]);
    },
    onError: (error) => setActionError(error.message || 'The member could not be updated. Please retry.'),
  });
  const review = (change: NonNullable<typeof pending>) => { setActionError(''); setPending(change); };
  return <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
    <Helmet><title>{data?.studio.name || 'Studio details'} — Maison Affluency</title><meta name="description" content="Private studio membership and invitation details." /><meta name="robots" content="noindex, nofollow" /></Helmet>
    {!rolesLoaded ? <p className="text-muted-foreground">Checking access…</p> : !enabled ? <p className="text-destructive">Administrator access required.</p> : <>
      <Link to="/trade/admin/studios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Studios</Link>
      {query.isError ? <div role="alert" className="text-destructive">Studio details could not be loaded. <Button variant="link" onClick={() => query.refetch()}>Retry</Button></div> : query.isPending ? <p role="status" className="text-muted-foreground">Loading studio…</p> : !data ? <p className="text-muted-foreground">Studio not found.</p> : <>
        <header className="flex items-start justify-between gap-4"><div className="min-w-0"><h1 className="flex items-center gap-3 break-words font-display text-3xl text-foreground"><Building2 className="h-6 w-6 shrink-0" />{data.studio.name}</h1>{data.studio.display_name && data.studio.display_name !== data.studio.name && <p className="mt-2 text-muted-foreground">{data.studio.display_name}</p>}<p className="mt-3 text-sm text-muted-foreground">Created {date(data.studio.created_at)} (UTC)</p>{data.studio.billing_email && <p className="mt-1 break-all text-sm text-muted-foreground">{data.studio.billing_email}</p>}</div><Button variant="outline" size="icon" title="Refresh studio" aria-label="Refresh studio" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button></header>
        <section aria-labelledby="studio-members">
          <h2 id="studio-members" className="mb-4 font-display text-xl text-foreground">Members <span className="text-muted-foreground">({data.members.length})</span></h2>
          {!data.members.length ? <p className="text-sm text-muted-foreground">No members.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm">
            <thead className="border-y border-border text-xs text-muted-foreground"><tr>{['Member', 'Role', 'Joined (UTC)', ''].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{data.members.map(member => <tr key={member.id} className="border-b border-border">
              <td className="px-4 py-4"><p className="font-medium text-foreground">{member.name}</p><p className="mt-1 text-xs text-muted-foreground">{member.email || '—'}</p></td>
              <td className="px-4 py-4">{member.role === 'owner' ? <span className="capitalize">Owner</span> : <Select value={member.role} disabled={mutation.isPending} onValueChange={role => { if (role === 'admin' || role === 'editor' || role === 'viewer') review({ member, role }); }}>
                <SelectTrigger className="w-36 capitalize" aria-label={`Role for ${member.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>{(['admin', 'editor', 'viewer'] as const).map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}</SelectContent>
              </Select>}</td>
              <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{date(member.joined_at)}</td>
              <td className="px-4 py-4 text-right">{member.role === 'owner' ? <span className="whitespace-nowrap text-xs text-muted-foreground">Owner protected</span> : <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={`Remove ${member.name}`} aria-label={`Remove ${member.name}`} disabled={mutation.isPending} onClick={() => review({ member })}><Trash2 className="h-4 w-4" /></Button>}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>
        <section aria-labelledby="studio-invitations"><h2 id="studio-invitations" className="mb-4 font-display text-xl text-foreground">Pending invitations <span className="text-muted-foreground">({data.invitations.length})</span></h2>{!data.invitations.length ? <p className="text-sm text-muted-foreground">No pending invitations.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-border text-xs text-muted-foreground"><tr>{['Email', 'Role', 'Status', 'Invited (UTC)', 'Expires (UTC)'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.invitations.map(invite => <tr key={invite.id} className="border-b border-border"><td className="px-4 py-4 text-foreground">{invite.email}</td><td className="px-4 py-4 capitalize">{invite.role}</td><td className={`px-4 py-4 ${invite.expired ? 'text-destructive' : 'text-muted-foreground'}`}>{invite.expired ? 'Expired' : 'Pending'}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{date(invite.created_at)}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{date(invite.expires_at)}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </>}
    <AlertDialog open={enabled && Boolean(pending)} onOpenChange={open => { if (!open && !mutation.isPending) { setPending(null); setActionError(''); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.role ? 'Change member role?' : 'Remove studio member?'}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.role ? <>Change {pending.member.name} from <span className="capitalize">{pending.member.role}</span> to <span className="capitalize">{pending.role}</span> in {data?.studio.name}? This changes their studio permissions, not their platform role.</> : <>Remove {pending?.member.name} from {data?.studio.name}? They will lose membership access to this studio. Their account and studio records will not be deleted.</>}</AlertDialogDescription>
        </AlertDialogHeader>
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <Button variant={pending?.role ? 'default' : 'destructive'} disabled={mutation.isPending} onClick={() => { if (pending) mutation.mutate(pending); }}>{mutation.isPending ? 'Saving…' : pending?.role ? 'Confirm role change' : 'Remove member'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}