import { Move, RotateCcw, RectangleHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { clampRugOffset, clampRugSize } from "@/lib/visualiserRoomSurfaces";
import { clampRugRotation } from "@/lib/visualiserRugRotation";

type Props = {
  className?: string;
  width: number | null;
  depth: number | null;
  offsetX: number;
  offsetZ: number;
  rotation: number;
  visible: boolean;
  disabled: boolean;
  onWidthChange: (value: number | null) => void;
  onDepthChange: (value: number | null) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetZChange: (value: number) => void;
  onRotationChange: (value: number) => void;
  onVisibleChange: (value: boolean) => void;
};

export default function RugLayoutControls(props: Props) {
  const inactive = props.disabled || !props.visible;
  const controls = [
    { label: "Width", aria: "Rug width", value: props.width ?? 4.5, min: 1, max: 8, display: props.width === null ? "Auto" : `${props.width.toFixed(1)} m`, change: (v: number) => props.onWidthChange(clampRugSize(v)) },
    { label: "Depth", aria: "Rug depth", value: props.depth ?? 3.8, min: 1, max: 8, display: props.depth === null ? "Auto" : `${props.depth.toFixed(1)} m`, change: (v: number) => props.onDepthChange(clampRugSize(v)) },
    { label: "Left / Right", aria: "Rug left right position", value: props.offsetX, min: -4, max: 4, display: `${props.offsetX > 0 ? "+" : ""}${props.offsetX.toFixed(1)} m`, change: (v: number) => props.onOffsetXChange(clampRugOffset(v)) },
    { label: "Back / Front", aria: "Rug back front position", value: props.offsetZ, min: -4, max: 4, display: `${props.offsetZ > 0 ? "+" : ""}${props.offsetZ.toFixed(1)} m`, change: (v: number) => props.onOffsetZChange(clampRugOffset(v)) },
  ];
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" className={props.className} aria-label="Rug size and position"><RectangleHorizontal className="mr-2 h-3.5 w-3.5" />Rug</Button>
    </PopoverTrigger>
    <PopoverContent side="top" align="start" className="z-[80] w-80 max-w-[calc(100vw-2rem)] space-y-5" aria-label="Rug size and position">
      <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Rug size &amp; position</h3><Switch checked={props.visible} onCheckedChange={props.onVisibleChange} disabled={props.disabled} aria-label="Show rug" /></div>
      {controls.map((control) => <div key={control.aria} className="space-y-3">
        <div className="flex items-center justify-between text-xs"><span>{control.label}</span><output className="tabular-nums text-muted-foreground">{control.display}</output></div>
        <Slider thumbLabel={control.aria} min={control.min} max={control.max} step={0.1} value={[control.value]} disabled={inactive} onValueChange={([value]) => { if (value !== undefined) control.change(value); }} />
      </div>)}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs"><span>Rotation</span><output className="tabular-nums text-muted-foreground">{Math.round(props.rotation)}°</output></div>
        <Slider thumbLabel="Rug rotation" min={0} max={360} step={1} value={[props.rotation]} disabled={inactive} onValueChange={([value]) => { if (value !== undefined) props.onRotationChange(clampRugRotation(value)); }} />
      </div>
      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={inactive} onClick={() => { props.onWidthChange(null); props.onDepthChange(null); props.onOffsetXChange(0); props.onOffsetZChange(0); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Auto-fit</Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={inactive} onClick={() => { props.onOffsetXChange(0); props.onOffsetZChange(0); }}><Move className="mr-1.5 h-3.5 w-3.5" />Centre</Button>
      </div>
    </PopoverContent>
  </Popover>;
}