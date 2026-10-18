import { useState } from "react";
import { Share2, Loader2, Copy, Ban } from "lucide-react";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listProjectSnapshots, type ProjectSnapshot } from "@/lib/projectLayoutSnapshots";
import { copyTextToClipboard } from "@/lib/clipboard";
import { absoluteUrl } from "@/config/site";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";
export default function WorkspaceShare() {
  const project = useActiveProject();
  const { currentStudio } = useStudio();
  const [open, setOpen] = useState(false), [invite, setInvite] = useState(false), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Project presentation"), [error, setError] = useState("");
  const [views, setViews] = useState<ProjectSnapshot[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [board, setBoard] = useState<string | null>(null), [link, setLink] = useState("");
  const start = async () => {
    if (!project) return;
    setOpen(true); setBusy(true); setError("");
    try { setViews(await listProjectSnapshots(project.state.projectId)); } catch { setError("Could not load saved views. Please try again."); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!project) return;
    setBusy(true); setError("");
    try {
      const { data, error: err } = await supabase.rpc("create_workspace_share", { _project_key: project.state.projectId, _title: title.trim(), _floor_plan: project.state.floorPlanUrl ?? undefined, _snapshot_ids: selected, _studio_name: currentStudio?.display_name || currentStudio?.name || "", _studio_logo: currentStudio?.logo_url || "" });
      if (err || !data) throw err;
      setBoard(data);
      const { data: slug, error: slugError } = await supabase.rpc("board_share_slug", { _board_id: data });
      if (slugError || !slug) throw slugError;
      setLink(absoluteUrl(`/shared/board/${slug}`));
    } catch { setError("Could not create the presentation. Your project has not changed."); } finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!board) return;
    setBusy(true);
    const { error: err } = await supabase.rpc("revoke_workspace_share", { _board_id: board });
    if (err) setError("Could not revoke this link. Please try again."); else { setBoard(null); setLink(""); setOpen(false); }
    setBusy(false);
  };
  return <>
    <Button variant="outline" size="sm" className="shrink-0" onClick={() => void start()}><Share2 className="h-4 w-4" />Share workspace</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle className="font-display">Share workspace</DialogTitle><DialogDescription>Private client presentation. No prices, editing or approvals.</DialogDescription></DialogHeader>
      {board && link ? <div className="space-y-4"><Input readOnly value={link} aria-label="Workspace share link" /><Button className="w-full" onClick={() => { setOpen(false); setInvite(true); }}><Share2 className="h-4 w-4" />Invite client</Button><Button variant="outline" onClick={() => void copyTextToClipboard(link)}><Copy className="h-4 w-4" />Copy link</Button><Button variant="ghost" disabled={busy} onClick={() => void revoke()}><Ban className="h-4 w-4" />Revoke link</Button></div> : <div className="space-y-4"><Label htmlFor="workspace-share-title">Presentation name</Label><Input id="workspace-share-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
        {project?.state.floorPlanUrl && <p className="text-sm text-muted-foreground">Current floor plan included</p>}
        <div className="max-h-72 space-y-3 overflow-y-auto">{views.map(v => <Label key={v.id} className="flex items-center gap-3"><Checkbox checked={selected.includes(v.id)} disabled={busy} onCheckedChange={checked => setSelected(ids => checked ? [...ids, v.id] : ids.filter(id => id !== v.id))} /><span className="min-w-0 break-words">{v.name}<span className="block text-xs text-muted-foreground">{v.piece_count} pieces</span></span></Label>)}</div>
        {!busy && !views.length && <p className="text-sm text-muted-foreground">No saved room views. Save a Project Snapshot to include a room.</p>}
        <Button className="w-full" disabled={busy || !title.trim() || selected.length > 20 || (!selected.length && !project?.state.floorPlanUrl)} onClick={() => void save()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create read-only link</Button></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent></Dialog>
    {board && <InviteCollaboratorDialog open={invite} onOpenChange={setInvite} boardId={board} readOnly onInvited={() => {}} />}
  </>;
}