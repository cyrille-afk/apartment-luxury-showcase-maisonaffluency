import { useEffect, useState } from "react";
import { FolderInput, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listPairingFolders, moveStudioPiece, type PairingFolder, type StudioFolderPlacement } from "@/lib/studioPairingFolders";

export function StudioPieceMovePicker({ projectId, productId, productName, placements, onMoved }: {
  projectId: string; productId: string; productName: string; placements: StudioFolderPlacement[]; onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<PairingFolder[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = placements.find(placement => placement.itemId === sourceId);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSourceId(placements.length === 1 ? placements[0].itemId : "");
    setError(null);
    setLoading(true);
    void listPairingFolders(projectId, productId).then(result => { if (!cancelled) setFolders(result.folders); })
      .catch(() => { if (!cancelled) setError("Project sub-folders could not be loaded. Reopen to try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, productId, placements]);
  const move = async (destinationId: string) => {
    if (!source || source.locked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const destination = await moveStudioPiece(projectId, source.itemId, source.folderId, destinationId);
      setOpen(false);
      toast.success(`Moved to ${destination.title}`, { description: productName, duration: 3500 });
      window.dispatchEvent(new Event("trade_favorite_folders_changed"));
      onMoved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The piece could not be moved."); }
    finally { setBusy(false); }
  };
  if (!placements.length) return null;
  return <Popover open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <PopoverTrigger asChild><Button variant="ghost" size="sm" aria-label={`Move ${productName} to another sub-folder`} className="min-h-9 rounded-none px-2 font-body text-[9px] uppercase tracking-wider text-muted-foreground"><FolderInput className="h-3 w-3" />Move</Button></PopoverTrigger>
    <PopoverContent align="start" aria-label="Move saved piece" className="z-[120] w-80 max-w-[calc(100vw-2rem)] rounded-sm p-3" onEscapeKeyDown={event => event.stopPropagation()}>
      <p className="mb-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Move saved piece</p>
      {placements.length > 1 && <label className="mb-3 block text-xs text-muted-foreground">From sub-folder<select aria-label="Source sub-folder" value={sourceId} disabled={busy} onChange={event => setSourceId(event.target.value)} className="mt-2 w-full border border-border bg-background p-2 text-foreground"><option value="">Select saved piece</option>{placements.map(placement => <option key={placement.itemId} value={placement.itemId}>{placement.folderTitle}{placement.finish ? ` — ${placement.finish}` : ""}</option>)}</select></label>}
      {source && <p className="mb-3 break-words text-xs text-muted-foreground">From: {source.folderTitle}{source.finish ? ` · ${source.finish}` : ""}</p>}
      {source?.locked ? <p className="text-xs text-muted-foreground">This piece is linked to a quote and cannot be moved here.</p> : loading ? <p role="status" className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading sub-folders</p> : <div className="max-h-56 overflow-y-auto">{folders.filter(folder => folder.id !== source?.folderId).map(folder => <Button key={folder.id} variant="ghost" disabled={!source || busy} onClick={() => void move(folder.id)} className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none px-2 py-3 text-left text-xs"><FolderOpen className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 break-words">{folder.title}</span></Button>)}{source && folders.length < 2 && <p className="py-3 text-xs text-muted-foreground">No other sub-folders in this project.</p>}</div>}
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </PopoverContent>
  </Popover>;
}