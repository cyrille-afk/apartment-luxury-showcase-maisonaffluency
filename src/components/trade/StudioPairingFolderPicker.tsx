import { useEffect, useState } from "react";
import { Check, FolderOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPairingFolder, listPairingFolders, savePairingToFolder, type PairingFolder } from "@/lib/studioPairingFolders";

export function StudioPairingFolderPicker({ projectId, productId, productName, onSaved, className }: {
  projectId: string; productId: string; productName: string; onSaved: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<PairingFolder[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [createdFolder, setCreatedFolder] = useState<PairingFolder | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPairingFolders(projectId, productId).then(result => {
      if (cancelled) return;
      setFolders(result.folders);
      setSavedIds(result.saved);
    }).catch(() => {
      if (!cancelled) setError("Project folders could not be loaded. Please try again.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, productId, retry]);

  const confirmSave = (folder: PairingFolder) => {
    setSavedIds(current => new Set(current).add(folder.id));
    setOpen(false);
    setCreating(false);
    setCreatedFolder(null);
    setName("");
    toast.success(`Saved to ${folder.title}`, { description: productName, duration: 3500 });
    window.dispatchEvent(new Event("trade_favorite_folders_changed"));
    window.dispatchEvent(new Event("trade-projects:changed"));
    onSaved();
  };

  const save = async (folderId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { confirmSave(await savePairingToFolder(projectId, folderId, productId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The piece could not be saved. Please try again."); }
    finally { setBusy(false); }
  };

  const createAndSave = async () => {
    if (busy || (!createdFolder && !name.trim())) return;
    setBusy(true);
    setError(null);
    try {
      const folder = createdFolder || await createPairingFolder(projectId, name);
      setCreatedFolder(folder);
      setFolders(current => current.some(item => item.id === folder.id) ? current : [folder, ...current]);
      confirmSave(await savePairingToFolder(projectId, folder.id, productId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The sub-folder could not be saved. Please try again."); }
    finally { setBusy(false); }
  };

  return <Popover open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" aria-label={`Add ${productName} to project folder`} className={className}><Plus className="h-3 w-3" />Add</Button></PopoverTrigger>
    <PopoverContent align="start" side="bottom" aria-label="Select project sub-folder" className="z-[120] w-80 max-w-[calc(100vw-2rem)] rounded-sm p-2" onEscapeKeyDown={event => event.stopPropagation()}>
      <p className="px-2 py-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Select project sub-folder</p>
      {loading ? <p role="status" className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading folders</p> : <div className="max-h-56 overflow-y-auto">
        {folders.map(folder => <Button key={folder.id} variant="ghost" disabled={busy || savedIds.has(folder.id)} onClick={() => void save(folder.id)} className="h-auto min-h-10 w-full justify-start whitespace-normal rounded-none px-2 py-3 text-left font-body text-[11px] text-foreground">
          {savedIds.has(folder.id) ? <Check className="h-3.5 w-3.5 shrink-0" /> : <FolderOpen className="h-3.5 w-3.5 shrink-0" />}<span className="min-w-0 flex-1 break-words">{folder.title}</span>{savedIds.has(folder.id) && <span className="text-[9px] text-muted-foreground">Saved</span>}
        </Button>)}
        {!folders.length && !error && <p className="px-2 py-3 text-xs text-muted-foreground">No sub-folders yet.</p>}
      </div>}
      <div className="mt-2 border-t border-border pt-2">
        {creating ? <form onSubmit={event => { event.preventDefault(); void createAndSave(); }} className="space-y-3 px-2 py-2">
          <Input autoFocus aria-label="New sub-folder name" placeholder="Sub-folder name" value={name} maxLength={120} disabled={busy || !!createdFolder} onChange={event => setName(event.target.value)} className="text-xs" />
          <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy || (!name.trim() && !createdFolder)}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}{createdFolder ? "Retry save" : "Create & save"}</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setCreating(false); setCreatedFolder(null); setName(""); }}>Cancel</Button></div>
        </form> : <Button variant="ghost" disabled={busy || loading} onClick={() => setCreating(true)} className="min-h-10 w-full justify-start rounded-none px-2 font-body text-[11px]"><Plus className="h-3.5 w-3.5" />Create New Sub-Folder</Button>}
      </div>
      {error && <div className="px-2 py-2"><p role="alert" className="text-xs text-destructive">{error}</p>{!folders.length && <Button variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>Try again</Button>}</div>}
    </PopoverContent>
  </Popover>;
}