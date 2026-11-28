import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Orbit, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { prepareAiRenderImages } from "@/lib/aiRenderImages";
import { prepareProductReferenceImages } from "@/lib/productReferenceImages";
import { cropRoomPlan, ROOM_TYPES, type RoomZone, type RoomType } from "@/lib/roomZone";
import { ROOM_CORNER_VIEWS, moveRoomRig, requireRoomTurntable, roomCropDataUrl, publishableRoomAngles } from "@/lib/roomTurntable";
import { listResidenceShellLayouts } from "@/lib/residenceShells.functions";
import { listResidenceRoomPackages, listMatchingResidenceRooms, saveResidenceRoom } from "@/lib/residenceRooms.functions";
import type { ProposalProduct } from "@/lib/proposalRenderDraft";
import { toast } from "@/hooks/use-toast";

type GeneratedRoom = { url: string; zone: RoomZone; pieces: ProposalProduct[]; shellUrl: string | null };
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
  const [placed,setPlaced] = useState(Boolean(initialZone));
  const [elevation,setElevation] = useState(8);
  const [omitted,setOmitted] = useState<string[]>([]);
  const [loading,setLoading] = useState(false),[publishing,setPublishing] = useState(false);
  const [result,setResult] = useState<GeneratedRoom|null>(null);
  const [feedback,setFeedback] = useState("");
  const [layoutId,setLayoutId] = useState(""),[packageId,setPackageId] = useState("");
  const [angles,setAngles] = useState<{ label: string; url: string }[]|null>(null);
  const [savedRoomId,setSavedRoomId] = useState("");
  const plan = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
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
  const views = ROOM_CORNER_VIEWS.map(v => ({ ...v,elevation }));
  const selected = pieces.filter(p => !omitted.includes(p.id) && (!p.room_section || p.room_section === zone.room_name));
  const initialZoneKey = JSON.stringify(initialZone);
  useEffect(() => { if (initialZone) { setZone(initialZone);setPlaced(true); } setResult(null);setAngles(null);setFeedback(""); },[sourceImageUrl,initialZoneKey]);
  function move(clientX: number,clientY: number) {
    const bounds = plan.current?.getBoundingClientRect();if (!bounds || busy) return;
    setZone(current => moveRoomRig(current,(clientX-bounds.left)/bounds.width*100,(clientY-bounds.top)/bounds.height*100));setPlaced(true);
  }
  function resize(key: "width"|"height",value: number) {
    if (!Number.isFinite(value)) return;
    setZone(current => { const size = Math.max(2,Math.min(95,value));return moveRoomRig({ ...current,[key]: size },current.x+current.width/2,current.y+current.height/2); });setPlaced(true);
  }
  async function generate() {
    if (!sourceImageUrl || busy) return;
    setLoading(true);setFeedback("");
    try {
      if (!placed) throw new Error("Place the camera rig on your room first.");
      requireRoomTurntable(zone,views);
      const crop = await roomCropDataUrl(await cropRoomPlan(sourceImageUrl,zone));
      const prepared = selected.length ? await prepareProductReferenceImages(selected) : null;
      const sameRoom = initialZone && JSON.stringify(zone) === JSON.stringify(initialZone);
      const { data,error } = await supabase.functions.invoke("axonometric-generate",{ body: await prepareAiRenderImages({ mode: "multi_view",imageUrl: crop,roomZone: zone,roomType: zone.room_type,views,gridLayout: "2x2",qualityTier: "standard",...(prepared ? { placements: prepared.pieces,browserReferenceImages: true } : {}),...(sameRoom && lockedRoomUrl ? { lockedRoomUrl } : {}) }) });
      if (error) throw error;if (data?.error) throw new Error(data.error);
      const url = data?.storedUrl || data?.imageUrl;if (!url) throw new Error("No room gallery returned.");
      setResult({ url,zone: { ...zone },pieces: selected.map(p => ({ ...p })),shellUrl: sameRoom ? shellUrl : null });setAngles(null);setSavedRoomId("");
    } catch(e) { const message = e instanceof Error ? e.message : "Try again.";setFeedback(message);toast({ title: "Room generation stopped",description: message,variant: "destructive" }); }
    finally { setLoading(false); }
  }
  async function publish() {
    if (!result || !packageId || busy) return;
    setPublishing(true);setFeedback("");
    try {
      if (!result.pieces.length) throw new Error("Attach this room's package pieces before generating and publishing.");
      const gallery = angles ?? await publishableRoomAngles(result.url);setAngles(gallery);
      await save({ data: { layoutId: savedRoom?.residence_layout_id ?? layoutId,packageId: savedRoom?.furniture_package_id ?? packageId,roomName: result.zone.room_name,roomType: result.zone.room_type,...(savedRoom ? { savedRoomId: savedRoom.id,expectedSignature: savedRoom.selection_signature } : {}),shellUrl: result.shellUrl,renderUrl: gallery[0]?.url ?? null,galleryViews: gallery,pieces: result.pieces.map(p => ({ product_id: p.product_id ?? p.id,product_name: p.product_name,brand_name: p.brand_name,...(p.target ? { target: p.target } : {}),...(p.selected_finishes ? { selected_finishes: p.selected_finishes } : {}),...(p.material_override ? { material_override: p.material_override } : {}) })) } });
      setFeedback(`Published all four ${result.zone.room_name} angles to the Private Viewing Room.`);
    } catch(e) { setFeedback(e instanceof Error ? e.message : "The gallery could not be published."); }
    finally { setPublishing(false); }
  }
  async function download() {
    if (!result) return;
    try { const response = await fetch(result.url);if (!response.ok) throw new Error("Download failed.");const url = URL.createObjectURL(await response.blob());const a = document.createElement("a");a.href = url;a.download = `${result.zone.room_name}-four-angles.png`;a.click();URL.revokeObjectURL(url); }
    catch { setFeedback("The gallery could not download. Please retry."); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!sourceImageUrl}><Orbit className="size-4" />{triggerLabel}</Button></DialogTrigger>
    <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Multi-View Turntable</DialogTitle></DialogHeader>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 space-y-2"><Label htmlFor="turntable-room">Room Label</Label><Select value={zone.room_type} disabled={busy} onValueChange={value => setZone(z => ({ ...z,room_type: value as RoomType,room_name: ROOM_TYPES[value as RoomType] }))}><SelectTrigger id="turntable-room"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ROOM_TYPES).map(([key,name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="turntable-elevation">Elevation °</Label><Input id="turntable-elevation" type="number" min={0} max={15} value={elevation} disabled={busy} onChange={e => setElevation(Math.max(0,Math.min(15,Number(e.target.value))))} /></div>
          <div className="space-y-2"><Label htmlFor="turntable-name">Room Name</Label><Input id="turntable-name" value={zone.room_name} maxLength={120} disabled={busy} onChange={e => setZone(z => ({ ...z,room_name: e.target.value }))} /></div>
        </div>
        <div ref={plan} className="relative w-full touch-none select-none overflow-hidden rounded border border-border" onPointerDown={e => { if (busy) return;e.currentTarget.setPointerCapture(e.pointerId);drag.current = true;move(e.clientX,e.clientY); }} onPointerMove={e => { if (drag.current) move(e.clientX,e.clientY); }} onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}>
          {sourceImageUrl && <img src={sourceImageUrl} alt="Room camera rig floor plan" draggable={false} className="w-full" />}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full cursor-crosshair text-primary" role="img" aria-label="Drag camera rig centre to the selected room">
            <path d={`M0 0H100V100H0Z M${zone.x} ${zone.y}v${zone.height}h${zone.width}v-${zone.height}Z`} fill="currentColor" fillRule="evenodd" opacity="0.28" />
            <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill="none" stroke="currentColor" strokeWidth="0.6" />
            {[[zone.x+2,zone.y+2],[zone.x+zone.width-2,zone.y+2],[zone.x+zone.width-2,zone.y+zone.height-2],[zone.x+2,zone.y+zone.height-2]].map(([x,y],i) => <g key={i}><line x1={x} y1={y} x2={zone.x+zone.width/2} y2={zone.y+zone.height/2} stroke="currentColor" strokeWidth="0.4" /><circle cx={x} cy={y} r="1.5" fill="currentColor" /><text x={x} y={(y ?? 0)+0.6} textAnchor="middle" className="fill-primary-foreground" fontSize="1.7">{i+1}</text></g>)}
            <circle cx={zone.x+zone.width/2} cy={zone.y+zone.height/2} r="3" fill="currentColor" /><path d={`M${zone.x+zone.width/2-2} ${zone.y+zone.height/2}h4 M${zone.x+zone.width/2} ${zone.y+zone.height/2-2}v4`} className="stroke-primary-foreground" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="turntable-width">Room crop width %</Label><Input id="turntable-width" type="number" min={2} max={95} value={Number(zone.width.toFixed(2))} disabled={busy} onChange={e => resize("width",Number(e.target.value))} /></div><div className="space-y-2"><Label htmlFor="turntable-height">Room crop height %</Label><Input id="turntable-height" type="number" min={2} max={95} value={Number(zone.height.toFixed(2))} disabled={busy} onChange={e => resize("height",Number(e.target.value))} /></div></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Locked catalogue references · {selected.length}</legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{pieces.map(p => <label key={p.id} className="flex min-w-0 items-center gap-3"><Checkbox checked={!omitted.includes(p.id)} disabled={busy} onCheckedChange={checked => setOmitted(ids => checked ? ids.filter(id => id !== p.id) : [...ids,p.id])} /><img src={p.image_url} alt={p.product_name} className="size-12 object-contain" /><span className="min-w-0 text-sm">{p.product_name}{p.room_section && p.room_section !== zone.room_name && <span className="block text-xs text-muted-foreground">{p.room_section} · excluded from this room</span>}</span></label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{zone.room_name} · 4 corners · {elevation}°</span><Button onClick={() => void generate()} disabled={busy || !sourceImageUrl || !placed}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Orbit className="size-4" />}{loading ? "Rendering…" : "Generate 4 Room Angles"}</Button></div>
        {result && <><div className="grid grid-cols-2 gap-2">{ROOM_CORNER_VIEWS.map((v,i) => <figure key={v.label}><div className="relative aspect-square overflow-hidden"><img src={result.url} alt={`${result.zone.room_name} — ${v.label}`} className={`absolute h-[200%] w-[200%] max-w-none ${i%2 ? 'right-0' : 'left-0'} ${i<2 ? 'top-0' : 'bottom-0'}`} /></div><figcaption className="py-2 text-xs">{v.label}</figcaption></figure>)}</div><Button variant="outline" onClick={() => void download()}><Download className="size-4" />Download</Button>
          <div className="space-y-3 border-t border-border pt-4"><Label>Publish {result.zone.room_name}</Label>
            {matchingRooms.isFetching && <p className="text-sm text-muted-foreground">Checking saved room packages…</p>}
            {!!matchingRooms.data?.length && <Select value={savedRoomId} disabled={busy} onValueChange={value => { setSavedRoomId(value);const room = matchingRooms.data?.find(r => r.id === value);if (room) { setLayoutId(room.residence_layout_id);setPackageId(room.furniture_package_id); } }}><SelectTrigger aria-label="Matching saved room package"><SelectValue placeholder="Select matching saved room package" /></SelectTrigger><SelectContent>{matchingRooms.data.map(room => <SelectItem key={room.id} value={room.id}>{room.residence_name} · {room.tier_name} · {room.room_name}</SelectItem>)}</SelectContent></Select>}
            {matchingRooms.isError && <Button variant="outline" onClick={() => void matchingRooms.refetch()}>Retry saved rooms</Button>}
            {!matchingRooms.isFetching && matchingRooms.data?.length === 0 && <p role="status" className="text-sm text-muted-foreground">No saved {result.zone.room_name} matches these {result.pieces.length} pieces. Save this room with its matching residence package first.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><Select value={layoutId} disabled={busy || !!savedRoom} onValueChange={value => { setLayoutId(value);setPackageId(""); }}><SelectTrigger aria-label="Residence"><SelectValue placeholder="Select residence" /></SelectTrigger><SelectContent>{layouts.data?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select><Select value={packageId} disabled={busy || !layoutId || !!savedRoom} onValueChange={setPackageId}><SelectTrigger aria-label="Furniture package"><SelectValue placeholder="Select furniture package" /></SelectTrigger><SelectContent>{packages.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.tier_name}</SelectItem>)}</SelectContent></Select></div>{(layouts.isError || packages.isError) && <Button variant="outline" onClick={() => { void layouts.refetch();void packages.refetch(); }}>Retry residences</Button>}<Button disabled={busy || matchingRooms.isFetching || matchingRooms.isError || !packageId || !result.pieces.length || (!!matchingRooms.data?.length && !savedRoom)} onClick={() => void publish()}>{publishing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{publishing ? "Publishing…" : "Publish 4-Angle Room Gallery"}</Button></div></>}
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
      </div>
    </DialogContent></Dialog>;
}
