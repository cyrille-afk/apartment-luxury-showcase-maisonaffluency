import { useState } from "react";
import { Camera, RotateCcw, Trash2, Loader2, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { DEFAULT_LAYOUT_BOUNDS } from "@/lib/activeProjectLayout";
import { deleteProjectSnapshot, listProjectSnapshots, loadProjectSnapshot, saveProjectSnapshot, snapshotData, type ProjectSnapshot } from "@/lib/projectLayoutSnapshots";
import { makePresetThumbnail, type ScenePresetData } from "@/lib/visualiserScenePresets";
import ScenePresets from "./ScenePresets";
import SnapshotComparison from "./SnapshotComparison";
import { toast } from "sonner";

export default function ProjectSnapshots({ className, current, onLoad }: { className: string; current: () => ScenePresetData; onLoad: (data: ScenePresetData) => void }) {
  const project = useActiveProject();
  const key = project?.state.projectId ?? "sandbox";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [list, setList] = useState<ProjectSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [action, setAction] = useState<{ snapshot: ProjectSnapshot; kind: "restore" | "delete" } | null>(null);
  const refresh = async () => {
    setBusy(true); setError(false); setList([]);
    try { setList(await listProjectSnapshots(key)); } catch { setError(true); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const scene = current();
      const data = snapshotData(scene, project?.state.bounds ?? DEFAULT_LAYOUT_BOUNDS, project?.state.floorPlanUrl ?? null);
      const saved = await saveProjectSnapshot(key, name, data, await makePresetThumbnail(scene.backdropDataUrl));
      setList(previous => [saved, ...previous]); setName(""); toast.success(`Saved snapshot “${saved.name}”`);
    } catch { toast.error("Couldn't save the snapshot. Your room is unchanged; please try again."); } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "delete") {
        await deleteProjectSnapshot(key, action.snapshot.id);
        setList(previous => previous.filter(s => s.id !== action.snapshot.id)); toast.success("Snapshot deleted");
      } else {
        const data = await loadProjectSnapshot(key, action.snapshot.id);
        onLoad(data.scene); project?.setBounds(data.bounds); project?.setFloorPlanUrl(data.floorPlanUrl);
        toast.success(`Restored “${action.snapshot.name}”`); setOpen(false);
      }
      setAction(null);
    } catch { toast.error("Couldn't complete this action. Please try again."); } finally { setBusy(false); }
  };
  return <>
    <Popover open={open} onOpenChange={value => { if (busy) return; setOpen(value); if (value) void refresh(); }}>
      <PopoverTrigger asChild><Button variant="ghost" className={className}><Camera className="mr-2 h-3.5 w-3.5" />Project Snapshots</Button></PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 max-w-[calc(100vw-2rem)] p-4">
        <h2 className="mb-3 text-sm font-medium">Project Snapshots</h2>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (!busy && name.trim()) void save(); }}>
          <Input aria-label="Snapshot name" placeholder="Snapshot name" maxLength={120} value={name} onChange={event => setName(event.target.value)} disabled={busy} className="h-9 min-w-0 text-xs" />
          <Button size="sm" type="submit" disabled={busy || !name.trim()}>Save</Button>
        </form>
        {list.length >= 2 && <Button variant="outline" size="sm" className="mt-3 w-full" disabled={busy} onClick={() => { setOpen(false); setComparing(true); }}><Columns2 className="h-4 w-4" />Compare snapshots</Button>}
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading snapshots" />}
          {error && <div className="text-xs text-muted-foreground">Snapshots couldn't load.<Button variant="link" size="sm" disabled={busy} onClick={() => void refresh()}>Retry</Button></div>}
          {!busy && !error && !list.length && <p className="text-xs text-muted-foreground">No saved snapshots for this project.</p>}
          {list.map(snapshot => <div key={snapshot.id} className="border-b border-border pb-3">
            {snapshot.thumbnail && <img src={snapshot.thumbnail} alt="" className="mb-2 aspect-[8/5] w-full rounded-sm object-cover" />}
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><p className="break-words text-xs font-medium">{snapshot.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{snapshot.piece_count} pieces · {new Date(snapshot.created_at).toLocaleString()}</p></div>
              <Button variant="ghost" size="icon" disabled={busy} aria-label={`Restore ${snapshot.name}`} title="Restore snapshot" onClick={() => setAction({ snapshot, kind: "restore" })}><RotateCcw className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${snapshot.name}`} title="Delete snapshot" onClick={() => setAction({ snapshot, kind: "delete" })}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
          </div>)}
        </div>
      </PopoverContent>
    </Popover>
    <ScenePresets className={className} current={current} onLoad={onLoad} />
    {comparing && <SnapshotComparison key={key} projectKey={key} snapshots={list} onClose={() => setComparing(false)} onRestore={snapshot => { setComparing(false); setAction({ snapshot, kind: "restore" }); }} />}
    <AlertDialog open={Boolean(action)} onOpenChange={value => { if (!value && !busy) setAction(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action?.kind === "restore" ? "Restore snapshot?" : "Delete snapshot?"}</AlertDialogTitle><AlertDialogDescription>{action?.kind === "restore" ? `“${action.snapshot.name}” will replace this project's current furniture, finishes and room settings. Save your current layout first if you want to keep it.` : `“${action?.snapshot.name}” will be permanently deleted. Your current room will not change.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void confirm(); }}>{busy ? "Please wait…" : action?.kind === "restore" ? "Restore" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>;
}
