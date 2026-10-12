import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_MODEL_ORIENTATION, MODEL_UP_AXIS_PRESETS, modelOrientationFromDegrees, modelOrientationToDegrees, rotateModelOrientation, type ModelOrientation, type ModelRotationDegrees } from "@/lib/modelOrientation";

type Props = {
  orientation?: ModelOrientation;
  onChange: (orientation: ModelOrientation) => void;
  onReset: () => void;
};

export default function ModelOrientationControls({ orientation, onChange, onReset }: Props) {
  const current = orientation ?? DEFAULT_MODEL_ORIENTATION;
  const [degrees, setDegrees] = useState(() => modelOrientationToDegrees(orientation).map(String));
  const emitted = useRef<ModelOrientation | null>(null);
  useEffect(() => {
    if (emitted.current && current.every((value, index) => Math.abs(value - (emitted.current?.[index] ?? 0)) < 1e-10)) return;
    setDegrees(modelOrientationToDegrees(orientation).map(String));
    emitted.current = null;
  }, [orientation]);
  const commit = () => {
    if (degrees.some(value => !value.trim() || !Number.isFinite(Number(value)))) {
      setDegrees(modelOrientationToDegrees(orientation).map(String));
      return;
    }
    const next = modelOrientationFromDegrees(degrees.map(Number) as ModelRotationDegrees);
    emitted.current = next;
    onChange(next);
  };
  return <TooltipProvider delayDuration={200}>
    <div className="mt-4 border-t border-border pt-3" role="group" aria-label="Model orientation">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase text-muted-foreground">Model orientation</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Reset model orientation" onClick={() => { emitted.current = null; setDegrees(["0", "0", "0"]); onReset(); }}><RotateCcw /></Button>
          </TooltipTrigger>
          <TooltipContent className="z-[80]">Reset to imported orientation</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 space-y-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis} className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2">
          <span className="text-xs text-muted-foreground">{axis}</span>
          <div className="relative">
            <Input type="number" step="0.1" aria-label={`Model ${axis} rotation degrees`} value={degrees[index]}
              className="h-8 min-w-0 pl-2 pr-5 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" onChange={event => setDegrees(values => values.map((value, i) => i === index ? event.target.value : value))}
              onBlur={commit} onKeyDown={event => {
                if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
                if (event.key === "Escape") { event.stopPropagation(); setDegrees(modelOrientationToDegrees(orientation).map(String)); }
              }} />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">°</span>
          </div>
          <div className="flex justify-center gap-1">
            {([-1, 1] as const).map(direction => <Tooltip key={direction}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={`Rotate model ${axis} ${direction === 1 ? "+90" : "−90"} degrees`}
                  onClick={() => onChange(rotateModelOrientation(current, axis, direction))}>
                  {direction === 1 ? <RotateCw /> : <RotateCcw />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-[80]">{axis} {direction === 1 ? "+90°" : "−90°"}</TooltipContent>
            </Tooltip>)}
          </div>
        </div>)}
      </div>
      <Select value="" onValueChange={id => {
        const preset = MODEL_UP_AXIS_PRESETS.find(item => item.id === id);
        if (!preset) return;
        const next = modelOrientationFromDegrees(preset.degrees);
        emitted.current = next;
        setDegrees(preset.degrees.map(String));
        onChange(next);
      }}>
        <SelectTrigger className="mt-3 h-8 w-full text-xs" aria-label="Model rotation preset"><SelectValue placeholder="Up-axis preset" /></SelectTrigger>
        <SelectContent className="z-[80]">
          {MODEL_UP_AXIS_PRESETS.map(preset => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  </TooltipProvider>;
}