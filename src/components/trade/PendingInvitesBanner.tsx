import { useEffect, useState } from "react";
import { Mail, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface PendingInvite {
  id: string;
  studio_id: string;
  studio_name: string | null;
  role: string;
  invited_by_name: string | null;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function PendingInvitesBanner() {
  const { user } = useAuth();
  const { refresh, setCurrentStudioId } = useStudio();
  const { toast } = useToast();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_my_pending_invites");
    if (error) {
      console.warn("get_my_pending_invites failed", error);
      setInvites([]);
    } else {
      setInvites((data ?? []) as PendingInvite[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAccept = async (inv: PendingInvite) => {
    if (!user || inv.is_expired) return;
    setAcceptingId(inv.id);
    // Insert membership; existing trigger on studio_invites handles auto-join
    // on sign-up, but for already-signed-in users we accept explicitly.
    const { error: memberErr } = await supabase
      .from("studio_members")
      .insert({ studio_id: inv.studio_id, user_id: user.id, role: inv.role as any });
    if (memberErr && !/(duplicate|unique)/i.test(memberErr.message)) {
      toast({ title: "Could not join studio", description: memberErr.message, variant: "destructive" });
      setAcceptingId(null);
      return;
    }
    // Mark invite accepted via SECURITY DEFINER RPC if available; else best-effort update
    await supabase
      .from("studio_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq("id", inv.id);
    toast({ title: "Joined studio", description: `You're now a ${ROLE_LABEL[inv.role] ?? inv.role} of ${inv.studio_name ?? "the studio"}.` });
    await refresh();
    setCurrentStudioId(inv.studio_id);
    setAcceptingId(null);
    load();
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4" />
        Studio invitations ({invites.length})
      </div>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm truncate">
                <span className="font-medium">{inv.studio_name ?? "Studio"}</span>
                <span className="text-muted-foreground"> · {ROLE_LABEL[inv.role] ?? inv.role}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                {inv.is_expired ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">
                      Expired {inv.expires_at ? formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true }) : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3" />
                    <span>
                      {inv.expires_at
                        ? `Expires ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}`
                        : "No expiry"}
                    </span>
                  </>
                )}
                {inv.invited_by_name && <span>· Invited by {inv.invited_by_name}</span>}
              </div>
            </div>
            <div className="shrink-0">
              {inv.is_expired ? (
                <Button size="sm" variant="outline" disabled>
                  Expired
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleAccept(inv)} disabled={acceptingId === inv.id}>
                  {acceptingId === inv.id ? "Joining…" : "Accept"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
