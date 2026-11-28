import { useRef,useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from "@/components/ui/select";
import { generateResidenceVisualization } from "@/lib/viewingRoom.functions";
import { roomSelectionKey,type ResidenceRoom } from "@/lib/residenceRooms";
import type { VisualizationChoice } from "@/lib/residenceVisualization";

export default function ResidenceRoomView({ token,packageId,rooms,roomId,onRoom,choices,disabled }: { token: string;packageId: string;rooms: ResidenceRoom[];roomId: string;onRoom: (id: string) => void;choices: VisualizationChoice[];disabled: boolean }) {
  const generate = useServerFn(generateResidenceVisualization);
  const [results,setResults] = useState<Record<string,{ url: string;signature: string }>>({});
  const [busy,setBusy] = useState(false),[error,setError] = useState("");
  const activeRequest = useRef(0);
  const room = rooms.find(r => r.id === roomId) ?? rooms[0];
  if (!room) return null;
  const signature = roomSelectionKey(choices,room.slot_ids);
  const result = results[room.id];
  const current = result?.signature === signature ? result.url : room.selection_signature === signature ? room.render_url : null;
  const previous = result?.url ?? room.render_url;
  const allRooms = roomId === "all";
  async function update() {
    if (!room || busy) return;
    const request = ++activeRequest.current;
    setBusy(true);setError("");
    try { const generated = await generate({ data: { token,packageId,shellUrl: room.shell_url,roomRenderId: room.id,choices } });if (activeRequest.current === request) setResults(all => ({ ...all,[room.id]: { url: generated.url,signature } })); }
    catch(e) { setError(e instanceof Error ? e.message : "The room view couldn’t be updated. Please retry."); }
    finally { if (activeRequest.current === request) setBusy(false); }
  }
  return <section aria-label="Residence room view" className="space-y-4 border-b border-border pb-6 pt-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="w-full space-y-2 sm:w-72"><label htmlFor="buyer-room" className="text-xs text-muted-foreground">Room</label><Select value={allRooms ? "all" : room.id} disabled={busy} onValueChange={id => { setError("");onRoom(id); }}><SelectTrigger id="buyer-room" className="min-h-12 font-display text-lg"><SelectValue /></SelectTrigger><SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.room_name}</SelectItem>)}<SelectItem value="all">Entire Collection</SelectItem></SelectContent></Select></div>
      {!allRooms && <Button variant="outline" disabled={busy || disabled} onClick={() => void update()}><Wand2 className="size-4" />{busy ? "Updating Room View…" : "Update Room View"}</Button>}</div>
    {!allRooms && <figure className="relative"><img src={current ?? previous ?? room.shell_url} alt={`${room.room_name}${current ? " — your selected furniture" : previous ? " — previous selection" : " — empty residence"}`} className="aspect-[16/9] max-h-[65dvh] w-full bg-muted/20 object-contain" />{!current && previous && <figcaption className="mt-2 text-sm text-muted-foreground">Previous selection · room view needs updating</figcaption>}{!current && !previous && <figcaption className="mt-2 text-sm text-muted-foreground">Empty {room.room_name.toLowerCase()} · furnished view pending</figcaption>}</figure>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Staging your selected room pieces…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}