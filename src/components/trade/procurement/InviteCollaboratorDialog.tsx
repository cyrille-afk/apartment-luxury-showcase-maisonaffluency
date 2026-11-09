import { useEffect, useRef, useState } from "react";
import { Link2 as LinkIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

// Share links must always point at the public production domain — the preview
// runs on a sandbox origin (lovableproject.com) that recipients cannot use.
const shareOrigin = () =>
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? window.location.origin
    : "https://www.maisonaffluency.com";

/** Masked display alias — never shows the raw token. */
function maskLink(url: string) {
  try { return `://${new URL(url).hostname}…`; } catch { return "://…"; }
}


export default function InviteCollaboratorDialog({ open, onOpenChange, boardId, onInvited, readOnly = false, projectId, projectName, boardOptions, boardsLoading = false, workspaceInvite = false, clientWorkspace = false }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: string;
  onInvited: () => void;
  readOnly?: boolean;
  projectId?: string;
  projectName?: string;
  boardOptions?: { id: string; title: string }[];
  boardsLoading?: boolean;
  workspaceInvite?: boolean;
  clientWorkspace?: boolean;
}) {
  const workspace = useProjectWorkspace();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setSelectedBoardId(null);
    wasOpen.current = open;
  }, [open]);
  const activeFolderId = workspace?.activeFolder?.projectId === projectId ? workspace?.activeFolder?.folderId : undefined;
  const defaultBoardId = clientWorkspace ? activeFolderId || boardId : boardId;
  const targetBoardId = boardOptions ? boardOptions.find(board => board.id === (selectedBoardId ?? defaultBoardId))?.id || "" : boardId;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "contractor">("client");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setEmail(""); setRole("client"); setLink(null); setError(null); setSelectedBoardId(null); };

  const send = async () => {
    if (sending || boardsLoading || !targetBoardId || ((workspaceInvite || clientWorkspace) && !projectId)) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSending(true);
    setError(null);
    const rollback = projectId && clientWorkspace
      ? workspace?.submitClientInvitation(projectId, targetBoardId, parsed.data)
      : undefined;
    let invitationCreated = false;
    try {
    const { data, error: err } = projectId
      ? await supabase.rpc(clientWorkspace ? "create_project_board_client_invite" : "create_project_board_view_invite", { _project_id: projectId, _board_id: targetBoardId, _email: parsed.data })
      : await supabase.rpc("create_board_invite" as any, { _board_id: targetBoardId, _email: parsed.data, _role: readOnly ? "client" : role });
    if (err || !data) {
      rollback?.();
      setSending(false);
      setError("Could not create the invite.");
      return;
    }
    invitationCreated = true;
    const { id, token } = data as { id: string; token: string };
    const { data: slug } = await supabase.rpc("board_share_slug" as any, { _board_id: targetBoardId });
    const url = `${shareOrigin()}/shared/board/${(slug as string) || token}`;
    setLink(url);
    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: { templateName: "board-collaborator-invite", recipientEmail: parsed.data, idempotencyKey: `board-invite-${id}`, templateData: { token } },
    });
    setSending(false);
    onInvited();
    toast({ title: mailErr ? "Invite created — email could not be sent, copy the link instead" : `Invite sent to ${parsed.data}` });
    } catch {
      if (!invitationCreated) rollback?.();
      setError(invitationCreated ? "Invite created, but delivery could not be confirmed. Check the invitation before retrying." : "Could not create the invite. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (sending) return; onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">{workspaceInvite ? "Invite Collaborator" : projectId ? "Invite architect or designer" : readOnly ? "Invite Client" : "Invite Collaborator"}</DialogTitle>
          <DialogDescription className="font-body text-xs">{clientWorkspace ? "Client access to the selected project folder, verified by email. Comments and approvals allowed; no editing or adding items. Invitation expires after 30 days." : projectId || workspaceInvite ? "View-only access to this project board, verified by email. No editing, comments or approvals. Invitation expires after 30 days." : "They receive a private link to this board, valid for 30 days."}</DialogDescription>
        </DialogHeader>
        {!link ? (
          <div className="space-y-5 pt-2">
            {clientWorkspace && <>
              <div className="space-y-1.5"><Label htmlFor="invite-project-name" className="font-body text-[10px] uppercase">Project workspace</Label><Input id="invite-project-name" readOnly value={projectName || (boardsLoading ? "Loading project…" : "No active project")} className="rounded-none" /></div>
              <div className="space-y-1.5"><Label htmlFor="invite-client-access" className="font-body text-[10px] uppercase">Access</Label><Input id="invite-client-access" readOnly value="Client (Read-Only - Comment/Approve)" className="rounded-none text-xs" /></div>
            </>}
            {boardOptions && <div className="space-y-1.5">
              <Label htmlFor="invite-project-board" className="font-body text-[10px] uppercase tracking-[0.18em]">{clientWorkspace ? "Project folder" : "Project board"}</Label>
              <select id="invite-project-board" value={targetBoardId} disabled={sending || boardsLoading} onChange={event => setSelectedBoardId(event.target.value)} className="h-10 w-full rounded-none border border-input bg-background px-3 font-body text-sm">
                <option value="">{boardsLoading ? "Loading project boards…" : "Select project board"}</option>
                {boardOptions.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}
              </select>
              {!boardsLoading && !projectId && <p role="status" className="font-body text-xs text-muted-foreground">Assign this quote to a project in the Quote Builder first.</p>}
              {!boardsLoading && projectId && !boardOptions.length && <p role="status" className="font-body text-xs text-muted-foreground">Add a board to this project before inviting your client.</p>}
            </div>}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="font-body text-[10px] uppercase tracking-[0.18em]">Email</Label>
              <Input id="invite-email" type="email" value={email} maxLength={255} disabled={sending} onChange={(e) => setEmail(e.target.value)} className="rounded-none" placeholder="name@example.com" />
            </div>
            {!readOnly && !projectId && <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="font-body text-[10px] uppercase tracking-[0.18em]">Role</Label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as any)} className="h-10 w-full rounded-none border border-input bg-background px-3 font-body text-sm">
                <option value="client">Client (Read-Only + Comment/Approve)</option>
                <option value="contractor">External Contractor (Can edit/add items)</option>
              </select>
            </div>}
            {error && <p className="font-body text-xs text-destructive">{error}</p>}
            <Button onClick={send} disabled={sending || boardsLoading || !targetBoardId || ((workspaceInvite || clientWorkspace) && !projectId)} className="w-full rounded-none">{sending ? "Sending…" : "Send Invite"}</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-stretch gap-2">
              <Input readOnly value={maskLink(link)} aria-label="Secure invitation link" className="rounded-none font-body text-xs text-muted-foreground" />
              <Button variant="outline" className="rounded-none whitespace-nowrap" onClick={async () => { await copyTextToClipboard(link); toast({ title: "Secure invitation link copied to clipboard" }); }}>
                <LinkIcon className="h-3.5 w-3.5" /> Copy Link
              </Button>
            </div>
            <Button className="w-full rounded-none" disabled={sending} onClick={reset}>{sending ? "Sending invitation…" : "Invite Another"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
