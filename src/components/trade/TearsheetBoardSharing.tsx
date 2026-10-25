import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, UserPlus, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserBoards } from "@/hooks/useUserBoards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";
import { boardInvitationPermission, boardInvitationStatus, type BoardInvitation } from "./boardInvitationStatus";
import ResendBoardInvitation from "./ResendBoardInvitation";

type Invite = BoardInvitation;

export default function TearsheetBoardSharing({ projectId, projectName }: { projectId: string; projectName: string }) {
  const queryClient = useQueryClient();
  const refreshAccess = () => { setRefresh(v => v + 1); void queryClient.invalidateQueries({ queryKey: ["tearsheet-board-access", projectId] }); };
  const [open, setOpen] = useState(false);
  const [boardId, setBoardId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { boards, loading: boardsLoading, error: boardsError } = useUserBoards(open, projectId);
  const projectBoards = boards.filter(b => b.project_id === projectId);
  const selectedBoard = projectBoards.find(b => b.id === boardId);

  useEffect(() => {
    if (!open || !selectedBoard) { setInvites([]); return; }
    let active = true;
    setLoading(true); setError(""); setInvites([]);
    supabase.from("board_invites").select("id, email, status, expires_at, last_seen_at, view_only, role")
      .eq("board_id", selectedBoard.id).order("created_at", { ascending: false })
      .then(({ data, error: failure }) => {
        if (!active) return;
        setLoading(false);
        if (failure) setError("Invitations could not be loaded. Try again.");
        else setInvites(data ?? []);
      });
    return () => { active = false; };
  }, [open, selectedBoard?.id, refresh]);

  const revoke = async (id: string) => {
    if (!selectedBoard || busy) return;
    setBusy(id); setError("");
    const { data, error: failure } = await supabase.from("board_invites").update({ status: "revoked" })
      .eq("id", id).eq("board_id", selectedBoard.id).select("id").maybeSingle();
    setBusy(null);
    if (failure || !data) { setError("Access could not be revoked. Try again."); return; }
    setConfirmId(null); refreshAccess();
  };

  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Share2 className="h-4 w-4" />Share project boards</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Share project boards</DialogTitle><DialogDescription>{projectName}</DialogDescription></DialogHeader>
        {boardsLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading boards…</p>
          : boardsError ? <p role="alert" className="text-sm text-destructive">Boards could not be loaded. Close and try again.</p>
          : projectBoards.length === 0 ? <p className="text-sm text-muted-foreground">No boards in this project yet.</p>
          : <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="share-tearsheet-board">Project board</Label>
              <select id="share-tearsheet-board" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={boardId} disabled={!!busy} onChange={e => { setBoardId(e.target.value); setConfirmId(null); }}>
                <option value="">Choose a board</option>{projectBoards.map(b => <option key={b.id} value={b.id}>{b.title} · {b.item_count} pieces</option>)}
              </select>
            </div>
            <Button className="w-full" disabled={!selectedBoard || !!busy || loading || !!error} onClick={() => { setOpen(false); setInviteOpen(true); }}><UserPlus className="h-4 w-4" />Invite architect or designer</Button>
            {selectedBoard && <section aria-label="Board invitations" className="border-t border-border pt-4">
              <h3 className="mb-3 font-display text-base">Invitations</h3>
              {loading ? <p role="status" className="text-sm text-muted-foreground">Loading invitations…</p> : invites.length === 0 && !error ? <p className="text-sm text-muted-foreground">No invitations yet.</p> :
                <ul className="divide-y divide-border">{invites.map(inv => {
                  const access = boardInvitationStatus(inv, Date.now());
                  const inactive = !access.canView;
                  const status = access.label;
                  return <li key={inv.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm">{inv.email}</p><p className="mt-1 text-xs text-muted-foreground">{boardInvitationPermission(inv)} · {status} · Expires {new Date(inv.expires_at).toLocaleDateString("en-GB")}</p></div>
                      {!inactive && <Button size="icon" variant="ghost" aria-label={`Revoke access for ${inv.email}`} title="Revoke access" disabled={!!busy} onClick={() => setConfirmId(inv.id)}><Ban className="h-4 w-4" /></Button>}
                    </div>
                    <ResendBoardInvitation projectId={projectId} boardId={selectedBoard.id} invite={inv} now={Date.now()} disabled={!!busy} onRenewed={refreshAccess} />
                    {confirmId === inv.id && <div className="flex flex-wrap items-center gap-2"><p className="text-xs text-muted-foreground">Remove this person’s access?</p><Button size="sm" variant="destructive" disabled={!!busy} onClick={() => void revoke(inv.id)}>{busy === inv.id ? "Revoking…" : "Revoke access"}</Button><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmId(null)}>Cancel</Button></div>}
                  </li>;
                })}</ul>}
            </section>}
            {error && <div role="alert" className="text-sm text-destructive">{error}<Button size="sm" variant="ghost" onClick={() => setRefresh(v => v + 1)}>Try again</Button></div>}
          </div>}
      </DialogContent>
    </Dialog>
    {selectedBoard && <InviteCollaboratorDialog key={selectedBoard.id} open={inviteOpen} onOpenChange={value => { setInviteOpen(value); if (!value) { refreshAccess(); setOpen(true); } }} boardId={selectedBoard.id} projectId={projectId} readOnly onInvited={refreshAccess} />}
  </>;
}