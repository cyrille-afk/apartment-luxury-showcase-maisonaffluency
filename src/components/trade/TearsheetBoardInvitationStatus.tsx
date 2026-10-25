import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { boardInvitationPermission, boardInvitationStatus } from "./boardInvitationStatus";

export default function TearsheetBoardInvitationStatus({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["tearsheet-board-access", projectId, user?.id, refreshKey],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error("Sign in required");
      const { data: boards, error } = await supabase.from("client_boards")
        .select("id, title").eq("project_id", projectId).eq("user_id", user.id).order("updated_at", { ascending: false });
      if (error) throw error;
      if (!boards?.length) return { boards: [], invites: [] };
      const { data: invites, error: inviteError } = await supabase.from("board_invites")
        .select("id, board_id, email, status, expires_at, last_seen_at, view_only, role")
        .in("board_id", boards.map(board => board.id)).order("created_at", { ascending: false });
      if (inviteError) throw inviteError;
      return { boards, invites: invites ?? [] };
    },
  });

  return <section aria-label="Project board invitation status" className="space-y-3 border-b border-border pb-5" data-trade-sensitive>
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg"><Users className="h-4 w-4 text-muted-foreground" />Board invitation status</h2>
      <Button size="icon" variant="ghost" aria-label="Refresh invitation status" title="Refresh invitation status" disabled={isFetching} onClick={() => { setNow(Date.now()); void refetch(); }}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
    </div>
    {isPending ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking invitations…</p>
      : isError ? <p role="alert" className="text-sm text-destructive">Invitation status could not be confirmed. Refresh to try again.</p>
      : !data?.boards.length ? <p className="text-sm text-muted-foreground">No boards in this project yet.</p>
      : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.boards.map(board => {
        const invites = data.invites.filter(invite => invite.board_id === board.id);
        const viewerCount = new Set(invites.filter(invite => boardInvitationStatus(invite, now).canView).map(invite => invite.email.trim().toLowerCase())).size;
        return <article key={board.id} aria-label={`${board.title} invitations`} className="min-w-0 rounded-md border border-border p-4">
          <h3 className="break-words font-display text-base">{board.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{viewerCount} invited {viewerCount === 1 ? "viewer" : "viewers"} with current access</p>
          {!invites.length ? <p className="mt-3 text-sm text-muted-foreground">No invitations yet.</p> : <ul className="mt-3 max-h-56 divide-y divide-border overflow-y-auto">{invites.map(invite => {
            const status = boardInvitationStatus(invite, now);
            return <li key={invite.id} className="py-2 text-xs">
              <p className="break-all text-sm">{invite.email}</p>
              <p className={`mt-1 ${status.canView ? "text-foreground" : "text-muted-foreground"}`}>{status.label} · {status.canView ? "Can view" : "No current access"}</p>
              <p className="mt-1 text-muted-foreground">{boardInvitationPermission(invite)} · Expires {new Date(invite.expires_at).toLocaleDateString("en-GB")}</p>
              {invite.last_seen_at && <p className="mt-1 text-muted-foreground">Last viewed {new Date(invite.last_seen_at).toLocaleString("en-GB")}</p>}
            </li>;
          })}</ul>}
        </article>;
      })}</div>}
  </section>;
}