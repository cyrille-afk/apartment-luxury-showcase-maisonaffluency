import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ClientPicker, { type PickedClient } from "@/components/trade/ClientPicker";
import InviteCollaboratorDialog from "@/components/trade/procurement/InviteCollaboratorDialog";
import { visualiserClientSelection } from "@/lib/visualiserClientSelection";
import type { PlacedObject } from "./SceneObject";

export default function VisualiserClientShare({ objects, projectId, projectName }: { objects: PlacedObject[]; projectId: string | null; projectName: string | null }) {
  const { currentStudio } = useStudio();
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState<PickedClient | null>(null);
  const [studioName, setStudioName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hideMaison, setHideMaison] = useState(true);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setTitle(projectName ? `${projectName} selection` : "Visualiser selection");
    setStudioName(currentStudio?.display_name || currentStudio?.name || "");
    setLogoUrl(currentStudio?.logo_url || "");
    setBoardId(null); setError(null); setOpen(true);
  };
  const save = async () => {
    if (!title.trim() || !objects.length) return;
    if (logoUrl && !/^https:\/\//i.test(logoUrl.trim())) { setError("Use a secure image address for your logo."); return; }
    setBusy(true); setError(null);
    try {
      const { data, error: err } = await supabase.rpc("create_visualiser_client_board" as any, {
        _title: title.trim(), _client_id: client?.id ?? null, _project_id: projectId,
        _studio_id: currentStudio?.id ?? null, _studio_name: studioName.trim(), _studio_logo_url: logoUrl.trim(),
        _hide_maison_branding: hideMaison, _items: visualiserClientSelection(objects),
      });
      if (err || typeof data !== "string") throw new Error("Could not save your selection. Please try again.");
      setBoardId(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save your selection."); }
    finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" size="sm" onClick={start} disabled={!objects.length} className="pointer-events-auto gap-2 bg-background" aria-label="Share selection with client"><Share2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Share with client</span></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display font-normal">Private Client Selection</DialogTitle></DialogHeader>
        {boardId ? <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">{objects.length} pieces saved with their selected finishes.</p>
          <Button className="w-full" onClick={() => { setOpen(false); setInviteOpen(true); }}><Share2 className="h-4 w-4" />Invite client</Button>
          <Button variant="outline" className="w-full" asChild><Link to={`/trade/boards/${boardId}`}><ExternalLink className="h-4 w-4" />Open selection & approvals</Link></Button>
        </div> : <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="visualiser-share-title">Selection name</Label><Input id="visualiser-share-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Client</Label><ClientPicker value={client?.id ?? null} onChange={setClient} readableNames /></div>
          <div className="border-t border-border pt-4 space-y-4">
            <p className="font-body text-xs uppercase">Client Portal Branding</p>
            <div className="space-y-2"><Label htmlFor="visualiser-share-studio">Studio name</Label><Input id="visualiser-share-studio" value={studioName} maxLength={120} onChange={(e) => setStudioName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="visualiser-share-logo">Studio logo</Label><Input id="visualiser-share-logo" type="url" placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></div>
            <div className="flex items-center justify-between gap-3"><Label htmlFor="visualiser-share-brand">Hide Maison Affluency branding</Label><Switch id="visualiser-share-brand" checked={hideMaison} onCheckedChange={setHideMaison} /></div>
          </div>
          {error && <p role="alert" className="font-body text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={save} disabled={busy || !title.trim() || !objects.length}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Saving…" : "Save private selection"}</Button>
        </div>}
      </DialogContent>
    </Dialog>
    {boardId && <InviteCollaboratorDialog open={inviteOpen} onOpenChange={setInviteOpen} boardId={boardId} onInvited={() => {}} />}
  </>;
}