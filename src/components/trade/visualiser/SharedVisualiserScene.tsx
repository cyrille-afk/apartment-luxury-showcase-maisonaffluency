import { lazy, Suspense, useState } from "react";
import { Box, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import type { SharedVisualiserRoom } from "@/lib/sharedVisualiserRoom";
import { rugColor, rugBorderColor, rugWeave } from "@/lib/visualiserRoomSurfaces";
const Canvas = lazy(() => import("./VisualiserCanvas"));
const noop = () => {};

export default function SharedVisualiserScene({ room, onSelectPiece, onApprove, approved, approvalDisabled, readOnly = false }: { room: SharedVisualiserRoom; onSelectPiece: (id: string) => void; onApprove: () => Promise<void>; approved: boolean; approvalDisabled: boolean; readOnly?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [failed, setFailed] = useState(false);
  const chosen = room.objects.find(o => o.instanceId === selected);
  const approve = async () => { setBusy(true); try { await onApprove(); } finally { setBusy(false); } };
  return <section className="mx-auto max-w-6xl px-6 pb-12">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h2 className="font-display text-xl">Complete Room Selection</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setVisible(v => !v)}><Box className="h-4 w-4" />{visible ? "Close room view" : "View room in 3D"}</Button>
        {!readOnly && <Button onClick={approve} disabled={busy || approved || approvalDisabled}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{approved ? "Room approved" : "Approve room selection"}</Button>}
      </div>
    </div>
    {visible && <div className="relative mt-4 h-[560px] max-h-[70dvh] overflow-hidden bg-background" aria-label="Shared room view">
      {room.backdropDataUrl && <img src={room.backdropDataUrl} alt="Room backdrop" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      <SceneErrorBoundary key={epoch} onError={() => setFailed(true)}>
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
          <Canvas {...room} isEditable={false} selectedId={selected} orbitEnabled hasBackdrop={Boolean(room.backdropDataUrl)} showGrid={false} showLabels={false}
            rugColor={rugColor(room.rugColor)} rugBorderColor={rugBorderColor(room.rugBorderColor)} rugWeave={rugWeave(room.rugWeave)}
            rugLayout={{ width: room.rugWidth, depth: room.rugDepth, offsetX: room.rugOffsetX, offsetZ: room.rugOffsetZ, rotation: room.rugRotation }}
            onSelect={setSelected} onTransform={noop} onDragStateChange={noop} />
        </Suspense>
      </SceneErrorBoundary>
      {failed && <div className="absolute inset-0 flex items-center justify-center bg-background"><Button variant="outline" onClick={() => { setFailed(false); setEpoch(e => e + 1); }}>Retry room view</Button></div>}
      {chosen?.boardItemId && !readOnly && <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-3"><span className="font-body text-sm">{chosen.product_name}</span><Button size="sm" variant="outline" onClick={() => { if (chosen.boardItemId) onSelectPiece(chosen.boardItemId); }}><Box className="h-4 w-4" />Review finishes</Button></div>}
    </div>}
  </section>;
}