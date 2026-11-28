import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Orbit, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import { prepareProductReferenceImages } from "@/lib/productReferenceImages";
import { type RoomZone } from "@/lib/roomZone";
import { ROOM_MASTER_VIEWS, requireRoomTurntable, publishableRoomAngles } from "@/lib/roomTurntable";
import { listResidenceShellLayouts } from "@/lib/residenceShells.functions";
import { listResidenceRoomPackages, listMatchingResidenceRooms, saveResidenceRoom } from "@/lib/residenceRooms.functions";
import type { ProposalProduct } from "@/lib/proposalRenderDraft";
import { toast } from "@/hooks/use-toast";

type GeneratedRoom = { url: string; zone: RoomZone; pieces: ProposalProduct[]; shellUrl: string | null; masterUrl: string };
interface MultiViewTurntableProps {
  sourceImageUrl: string | null | undefined;
  triggerLabel?: string;
  initialZone?: RoomZone | null;
  pieces?: ProposalProduct[];
  shellUrl?: string | null;
  lockedRoomUrl?: string | null;
}

export function MultiViewTurntable({ sourceImageUrl, triggerLabel = "Multi-View", initialZone = null, pieces = [], shellUrl = null, lockedRoomUrl = null }: MultiViewTurntableProps) {
  const [open,setOpen] = useState(false);
  const [zone,setZone] = useState<RoomZone>(initialZone ?? { x: 30,y: 30,width: 40,height: 40,room_type: "living_room",room_name: "Living Room" });
  const [verified,setVerified] = useState(false);
  const [loading,setLoading] = useState(false),[publishing,setPublishing] = useState(false);
  const [result,setResult] = useState<GeneratedRoom|null>(null);
  const [feedback,setFeedback] = useState("");
  const [layoutId,setLayoutId] = useState(""),[packageId,setPackageId] = useState("");
  const [angles,setAngles] = useState<{ label: string; url: string }[]|null>(null);
  const [savedRoomId,setSavedRoomId] = useState("");
  const list = useServerFn(listResidenceShellLayouts),listPackages = useServerFn(listResidenceRoomPackages),matchRooms = useServerFn(listMatchingResidenceRooms),save = useServerFn(saveResidenceRoom);
  const layouts = useQuery({ queryKey: ["residence-shell-layouts"],queryFn: () => list(),enabled: open,retry: false });
  const packages = useQuery({ queryKey: ["residence-room-packages",layoutId],queryFn: () => listPackages({ data: { layoutId } }),enabled: open && !!layoutId,retry: false });
  const publicationPieces = result?.pieces.map(p => ({ product_id: p.product_id ?? p.id,product_name: p.product_name,brand_name: p.brand_name })) ?? [];
  const matchingRooms = useQuery({ queryKey: ["matching-residence-rooms",result?.zone.room_name,publicationPieces],queryFn: () => matchRooms({ data: { roomName: result?.zone.room_name ?? "",pieces: publicationPieces } }),enabled: open && !!result && publicationPieces.length > 0,retry: false });
  const savedRoom = matchingRooms.data?.find(room => room.id === savedRoomId);
  useEffect(() => {
    const onlyRoom = matchingRooms.data?.length === 1 ? matchingRooms.data[0] : undefined;
    setSavedRoomId(onlyRoom?.id ?? "");
    if (onlyRoom) { setLayoutId(onlyRoom.residence_layout_id);setPackageId(onlyRoom.furniture_package_id); }
  },[matchingRooms.data]);
  const busy = loading || publishing;
  const views = ROOM_MASTER_VIEWS.map(v => ({ ...v }));
  const selected = pieces.filter(p => (!p.room_section || p.room_section === zone.room_name));
  const initialZoneKey = JSON.stringify(initialZone);
  useEffect(() => { if (initialZone) { setZone(initialZone); } setResult(null);setAngles(null);setFeedback("");setVerified(false); },[sourceImageUrl,initialZoneKey,lockedRoomUrl]);
  async function generate() {
    if (!sourceImageUrl || busy) return;
    setLoading(true);setFeedback("");
    try {
      requireRoomTurntable(zone,views,lockedRoomUrl,verified);
      if (!lockedRoomUrl) throw new Error("Generate and verify the Eye-Level Furniture Proposal first.");
      if (!selected.length) throw new Error("The master needs its placed catalogue references.");
      const prepared = await prepareProductReferenceImages(selected);
      const { data,error } = await supabase.functions.invoke("axonometric-generate",{ body: await prepareAiRenderImages({ mode: "multi_view",imageUrl: lockedRoomUrl,lockedRoomUrl,masterVerified: verified,roomZone: zone,roomType: zone.room_type,views,gridLayout: "2x1",qualityTier: "standard",placements: prepared.pieces,browserReferenceImages: true }) });
      if (error) throw error;if (data?.error) throw new Error(data.error);
      const url = data?.storedUrl || data?.imageUrl;if (!url) throw new Error("No room gallery returned.");
      setResult({ url,zone: { ...zone },pieces: selected.map(p => ({ ...p })),shellUrl,masterUrl: lockedRoomUrl });setAngles(null);setSavedRoomId("");
    } catch(e) { const message = e instanceof Error ? e.message : "Try again.";setFeedback(message);toast({ title: "Room generation stopped",description: message,variant: "destructive" }); }
    finally { setLoading(false); }
  }
  async function publish() {
    if (!result || !packageId || busy) return;
    setPublishing(true);setFeedback("");
    try {
      if (!result.pieces.length) throw new Error("Attach this room's package pieces before generating and publishing.");
      const gallery = angles ?? await publishableRoomAngles(result.url,result.masterUrl);setAngles(gallery);
      await save({ data: { layoutId: savedRoom?.residence_layout_id ?? layoutId,packageId: savedRoom?.furniture_package_id ?? packageId,roomName: result.zone.room_name,roomType: result.zone.room_type,...(savedRoom ? { savedRoomId: savedRoom.id,expectedSignature: savedRoom.selection_signature } : {}),shellUrl: result.shellUrl,renderUrl: gallery[0]?.url ?? null,galleryViews: gallery,pieces: result.pieces.map(p => ({ product_id: p.product_id ?? p.id,product_name: p.product_name,brand_name: p.brand_name,...(p.target ? { target: p.target } : {}),...(p.selected_finishes ? { selected_finishes: p.selected_finishes } : {}),...(p.material_override ? { material_override: p.material_override } : {}) })) } });
      setFeedback(`Published all three ${result.zone.room_name} angles to the Private Viewing Room.`);
    } catch(e) { setFeedback(e instanceof Error ? e.message : "The gallery could not be published."); }
    finally { setPublishing(false); }
  }
  async function download() {
    if (!result) return;
    try { const response = await fetch(result.url);if (!response.ok) throw new Error("Download failed.");const url = URL.createObjectURL(await response.blob());const a = document.createElement("a");a.href = url;a.download = `${result.zone.room_name}-side-angles.png`;a.click();URL.revokeObjectURL(url); }
    catch { setFeedback("The gallery could not download. Please retry."); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!sourceImageUrl}><Orbit className="size-4" />{triggerLabel}</Button></DialogTrigger>
    <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Multi-View Turntable</DialogTitle></DialogHeader>
      <div className="space-y-5">
        <figure className="space-y-2">{lockedRoomUrl ? <img src={lockedRoomUrl} alt="Master Eye-Level Furniture Proposal" className="max-h-[50dvh] w-full object-contain" /> : <p role="status" className="text-sm text-muted-foreground">Generate an Eye-Level Furniture Proposal for this room first.</p>}<figcaption className="text-sm">01 · Master Perspective · {zone.room_name}</figcaption></figure>
        <label className="flex items-center gap-3 text-sm"><Checkbox checked={verified} disabled={busy || !lockedRoomUrl} onCheckedChange={value => setVerified(value === true)} />Master furniture count, console position and walls verified</label>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Locked catalogue references · {selected.length}</legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{pieces.map(p => <label key={p.id} className="flex min-w-0 items-center gap-3"><img src={p.image_url} alt={p.product_name} className="size-12 object-contain" /><span className="min-w-0 text-sm">{p.product_name}{p.room_section && p.room_section !== zone.room_name && <span className="block text-xs text-muted-foreground">{p.room_section} · excluded from this room</span>}</span></label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{zone.room_name} · Master / −25° / +25°</span><Button onClick={() => void generate()} disabled={busy || !lockedRoomUrl || !verified || !selected.length}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Orbit className="size-4" />}{loading ? "Rendering…" : "Generate 3 Room Angles"}</Button></div>
        {result && <><div className="grid gap-3 sm:grid-cols-3">{ROOM_MASTER_VIEWS.map((v,i) => <figure key={v.label}><div className="relative aspect-[8/9] overflow-hidden">{i === 0 ? <img src={result.masterUrl} alt={v.label} className="size-full object-contain" /> : <img src={result.url} alt={v.label} className={`absolute h-full w-[200%] max-w-none ${i === 1 ? 'left-0' : 'right-0'}`} />}</div><figcaption className="py-2 text-xs">{v.label}</figcaption></figure>)}</div><Button variant="outline" onClick={() => void download()}><Download className="size-4" />Download</Button>
          <div className="space-y-3 border-t border-border pt-4"><Label>Publish {result.zone.room_name}</Label>
            {matchingRooms.isFetching && <p className="text-sm text-muted-foreground">Checking saved room packages…</p>}
            {!!matchingRooms.data?.length && <Select value={savedRoomId} disabled={busy} onValueChange={value => { setSavedRoomId(value);const room = matchingRooms.data?.find(r => r.id === value);if (room) { setLayoutId(room.residence_layout_id);setPackageId(room.furniture_package_id); } }}><SelectTrigger aria-label="Matching saved room package"><SelectValue placeholder="Select matching saved room package" /></SelectTrigger><SelectContent>{matchingRooms.data.map(room => <SelectItem key={room.id} value={room.id}>{room.residence_name} · {room.tier_name} · {room.room_name}</SelectItem>)}</SelectContent></Select>}
            {matchingRooms.isError && <Button variant="outline" onClick={() => void matchingRooms.refetch()}>Retry saved rooms</Button>}
            {!matchingRooms.isFetching && matchingRooms.data?.length === 0 && <p role="status" className="text-sm text-muted-foreground">No saved {result.zone.room_name} matches these {result.pieces.length} pieces. Save this room with its matching residence package first.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><Select value={layoutId} disabled={busy || !!savedRoom} onValueChange={value => { setLayoutId(value);setPackageId(""); }}><SelectTrigger aria-label="Residence"><SelectValue placeholder="Select residence" /></SelectTrigger><SelectContent>{layouts.data?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select><Select value={packageId} disabled={busy || !layoutId || !!savedRoom} onValueChange={setPackageId}><SelectTrigger aria-label="Furniture package"><SelectValue placeholder="Select furniture package" /></SelectTrigger><SelectContent>{packages.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.tier_name}</SelectItem>)}</SelectContent></Select></div>{(layouts.isError || packages.isError) && <Button variant="outline" onClick={() => { void layouts.refetch();void packages.refetch(); }}>Retry residences</Button>}<Button disabled={busy || matchingRooms.isFetching || matchingRooms.isError || !packageId || !result.pieces.length || (!!matchingRooms.data?.length && !savedRoom)} onClick={() => void publish()}>{publishing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{publishing ? "Publishing…" : "Publish 3-Angle Room Gallery"}</Button></div></>}
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
      </div>
    </DialogContent></Dialog>;
}
