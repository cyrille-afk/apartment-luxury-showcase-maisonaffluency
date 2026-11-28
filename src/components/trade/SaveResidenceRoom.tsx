import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { listResidenceShellLayouts } from "@/lib/residenceShells.functions";
import { listResidenceRoomPackages,saveResidenceRoom } from "@/lib/residenceRooms.functions";
import { requireEyeLevelTargets,type ProposalProduct } from "@/lib/proposalRenderDraft";
import type { RoomZone } from "@/lib/roomZone";

export default function SaveResidenceRoom({ shellUrl,renderUrl,zone,pieces,disabled }: { shellUrl: string|null;renderUrl: string|null;zone: RoomZone;pieces: ProposalProduct[];disabled: boolean }) {
  const [open,setOpen] = useState(false),[layoutId,setLayoutId] = useState(""),[packageId,setPackageId] = useState(""),[view,setView] = useState("render"),[busy,setBusy] = useState(false),[feedback,setFeedback] = useState("");
  const list = useServerFn(listResidenceShellLayouts),listPackages = useServerFn(listResidenceRoomPackages),save = useServerFn(saveResidenceRoom);
  const layouts = useQuery({ queryKey: ["residence-shell-layouts"],queryFn: () => list(),enabled: open,retry: false });
  const packages = useQuery({ queryKey: ["residence-room-packages",layoutId],queryFn: () => listPackages({ data: { layoutId } }),enabled: open && !!layoutId,retry: false });
  async function submit() {
    if (!shellUrl) return;
    setBusy(true);setFeedback("");
    try {
      requireEyeLevelTargets(pieces);
      const savedPieces = pieces.map(p => {
        if (!p.target) throw new Error("Assign every room piece a placement pin.");
        return { product_id: p.product_id ?? p.id,product_name: p.product_name,brand_name: p.brand_name,target: p.target,...(p.selected_finishes ? { selected_finishes: p.selected_finishes } : {}),...(p.material_override ? { material_override: p.material_override } : {}) };
      });
      await save({ data: { layoutId,packageId,roomName: zone.room_name,roomType: zone.room_type,shellUrl,renderUrl: view === "render" ? renderUrl : null,pieces: savedPieces } });
      setFeedback(`${zone.room_name} saved to ${packages.data?.find(p => p.id === packageId)?.tier_name ?? "this package"}.`);
    } catch(e) { setFeedback(e instanceof Error ? e.message : "This room couldn’t be saved. Please retry."); }
    finally { setBusy(false); }
  }
  return <><Button size="sm" variant="outline" disabled={disabled || !shellUrl || !pieces.length} onClick={() => { setView(renderUrl ? "render" : "shell");setFeedback("");setOpen(true); }}><Save className="size-4" />Save Room to Package</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle className="pr-8">Save {zone.room_name}</DialogTitle><DialogDescription>Residence &amp; collection</DialogDescription>
      <Label htmlFor="room-save-layout">Residence</Label><Select value={layoutId} disabled={busy} onValueChange={value => { setLayoutId(value);setPackageId(""); }}><SelectTrigger id="room-save-layout"><SelectValue placeholder="Select residence" /></SelectTrigger><SelectContent>{layouts.data?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="room-save-package">Furniture package</Label><Select value={packageId} disabled={busy || !layoutId} onValueChange={setPackageId}><SelectTrigger id="room-save-package"><SelectValue placeholder={packages.isFetching ? "Loading packages…" : "Select package"} /></SelectTrigger><SelectContent>{packages.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.tier_name}</SelectItem>)}</SelectContent></Select>
      {layoutId && packages.data?.length === 0 && <p className="text-sm text-muted-foreground">No furniture packages are assigned to this residence.</p>}
      <Label htmlFor="room-save-view">View to save</Label><Select value={view} disabled={busy} onValueChange={setView}><SelectTrigger id="room-save-view"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shell">Empty Room Shell</SelectItem>{renderUrl && <SelectItem value="render">Staged Room View</SelectItem>}</SelectContent></Select>
      {(view === "render" ? renderUrl : shellUrl) && <img src={(view === "render" ? renderUrl : shellUrl) ?? ""} alt={zone.room_name} className="aspect-video w-full object-contain" />}
      <ul className="text-sm">{pieces.map(p => <li key={p.id}>{p.product_name}</li>)}</ul>
      {(layouts.isError || packages.isError) && <Button variant="outline" onClick={() => { void layouts.refetch();if (layoutId) void packages.refetch(); }}><RotateCw className="size-4" />Retry choices</Button>}
      <Button disabled={busy || !packageId || !shellUrl || !pieces.length} onClick={() => void submit()}><Save className="size-4" />{busy ? "Saving…" : "Save Room View"}</Button>{feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent></Dialog></>;
}