import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listResidenceShellLayouts, saveResidenceShell } from "@/lib/residenceShells.functions";

export default function SaveResidenceShell({ url, disabled }: { url: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [layoutId, setLayoutId] = useState("");
  const [label, setLabel] = useState("Living Room View");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const list = useServerFn(listResidenceShellLayouts);
  const save = useServerFn(saveResidenceShell);
  const query = useQuery({ queryKey: ["residence-shell-layouts"], queryFn: () => list(), enabled: open, retry: false });
  const selected = query.data?.find(layout => layout.id === layoutId);
  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setFeedback(""); setOpen(true); }}><Save className="size-4" />Save as Residence Eye-Level Shell</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Save Residence Eye-Level Shell</DialogTitle><DialogDescription>Empty interior view</DialogDescription>
      <img src={url} alt="Empty residence eye-level view" className="aspect-video w-full object-contain" />
      <Label htmlFor="shell-layout">Residence floor plan</Label><Select value={layoutId} onValueChange={setLayoutId} disabled={busy}><SelectTrigger id="shell-layout"><SelectValue placeholder="Select residence" /></SelectTrigger><SelectContent>{query.data?.map(layout => <SelectItem key={layout.id} value={layout.id}>{layout.name} · {layout.id.slice(0,8)}</SelectItem>)}</SelectContent></Select>
      {selected?.floorplan_url && <img src={selected.floorplan_url} alt={`${selected.name} floor plan`} className="max-h-40 w-full object-contain" />}
      {query.isError && <p role="alert" className="text-sm text-destructive">Residences couldn’t load.<Button variant="ghost" onClick={() => void query.refetch()}>Retry</Button></p>}
      <Label htmlFor="shell-label">Camera angle name</Label><Input id="shell-label" value={label} maxLength={120} disabled={busy} onChange={event => setLabel(event.target.value)} />
      <Button disabled={busy || !layoutId || !label.trim()} onClick={async () => { setBusy(true); setFeedback(""); try { await save({ data: { layoutId, shell: { label: label.trim(), url } } }); setFeedback("Saved to this residence."); } catch { setFeedback("This view couldn’t be saved. Please retry."); } finally { setBusy(false); } }}><Save className="size-4" />{busy ? "Saving…" : "Save Residence View"}</Button>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent></Dialog>
  </>;
}