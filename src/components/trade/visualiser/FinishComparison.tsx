import { useMemo, useRef, useState, type ReactNode } from "react";
import { Columns2, Link2, Unlink, Lock, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlacedObject } from "./SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";
import { finishComparisonObjects } from "@/lib/visualiserFinishComparison";
import { getPartMaterial, type FinishTarget } from "@/lib/visualiserFinishTargets";
import type { ComparisonCameraLink, ComparisonCameraState } from "./ComparisonCameraSync";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type Props = {
  objects: PlacedObject[];
  object: PlacedObject;
  target: FinishTarget;
  targetName: string;
  materials: VisualiserMaterial[];
  renderRoom: (objects: PlacedObject[], camera: ComparisonCameraLink, onReady: () => void) => ReactNode;
  onApply: (material: VisualiserMaterial) => void;
};

export default function FinishComparison(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size="sm" className="mt-3 w-full gap-2 text-xs" disabled={!props.object.glb_url || props.materials.length === 0} onClick={() => setOpen(true)}>
      <Columns2 className="h-4 w-4" />Compare finishes
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="z-[100] flex h-[88dvh] w-[96vw] max-w-[1600px] flex-col gap-3 overflow-hidden rounded-md p-3 sm:p-5" overlayClassName="z-[99]">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="font-serif text-xl font-normal tracking-normal">{props.object.product_name}</DialogTitle>
            <DialogDescription className="mt-1 text-xs">Finish comparison · {props.targetName}</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close finish comparison" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
        </div>
        {open && <ComparisonPanels {...props} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  </>;
}

function ComparisonPanels({ objects, object, target, materials, renderRoom, onApply, onClose }: Props & { onClose: () => void }) {
  const current = getPartMaterial(object, target);
  const [choices, setChoices] = useState<[string, string]>(["saved", materials.find(material => material.id !== current?.id)?.id ?? "saved"]);
  const [ready, setReady] = useState<[boolean, boolean]>([false, false]);
  const [failed, setFailed] = useState<[boolean, boolean]>([false, false]);
  const [attempt, setAttempt] = useState<[number, number]>([0, 0]);
  const [camerasLinked, setCamerasLinked] = useState(true);
  const shared = useRef<ComparisonCameraState | null>(null);
  const options = useMemo(() => current && !materials.some(material => material.id === current.id) ? [current, ...materials] : materials, [current, materials]);
  const previews = useMemo(() => choices.map(choice => finishComparisonObjects(objects, object.instanceId, target, options.find(material => material.id === choice) ?? null)), [objects, object.instanceId, target, options, choices]);
  return <>
    <div className="flex shrink-0 items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground">{camerasLinked ? "Cameras linked" : "Cameras independent"}</span>
      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Link camera movement" aria-pressed={camerasLinked} onClick={() => setCamerasLinked(value => !value)}>
        {camerasLinked ? <Link2 className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
      </Button></TooltipTrigger><TooltipContent className="z-[110]">{camerasLinked ? "Unlink cameras" : "Link cameras"}</TooltipContent></Tooltip></TooltipProvider>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-4">
    {choices.map((choice, index) => {
      const material = options.find(option => option.id === choice);
      const side = index === 0 ? "A" : "B";
      return <section key={side} aria-label={`Finish ${side} preview`} className="flex min-h-0 min-w-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{side}</span>
          <Select value={choice} onValueChange={value => setChoices(previous => index === 0 ? [value, previous[1]] : [previous[0], value])}>
            <SelectTrigger aria-label={`Finish ${side}`} className="min-w-0 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[110] max-h-72"><SelectItem value="saved">Saved finish{current ? ` · ${current.name}` : ""}</SelectItem>{options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden border border-border bg-background">
          <SceneErrorBoundary key={attempt[index]} onError={() => { setFailed(previous => index === 0 ? [true, previous[1]] : [previous[0], true]); setReady(previous => index === 0 ? [false, previous[1]] : [previous[0], false]); }}>{renderRoom(previews[index], { id: side, shared, enabled: camerasLinked }, () => setReady(previous => previous[index] ? previous : index === 0 ? [true, previous[1]] : [previous[0], true]))}</SceneErrorBoundary>
          {failed[index] ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background p-2 text-center text-xs text-muted-foreground"><p>Room {side} couldn’t load.</p><Button variant="outline" size="sm" onClick={() => { setFailed(previous => index === 0 ? [false, previous[1]] : [previous[0], false]); setAttempt(previous => index === 0 ? [previous[0] + 1, previous[1]] : [previous[0], previous[1] + 1]); }}>Retry</Button></div> : !ready[index] && <p role="status" className="pointer-events-none absolute inset-x-2 bottom-3 bg-background/90 p-2 text-center text-xs text-muted-foreground">Loading room {side}…</p>}
        </div>
        <Button variant="outline" size="sm" className="h-auto min-h-9 shrink-0 whitespace-normal text-xs" disabled={!material || object.finishesLocked || !ready[index]} onClick={() => { if (material) { onApply(material); onClose(); } }}>
          {object.finishesLocked ? <><Lock className="mr-1 h-3 w-3" />Finishes locked</> : `Use finish ${side}`}
        </Button>
      </section>;
    })}
  </div></>;
}