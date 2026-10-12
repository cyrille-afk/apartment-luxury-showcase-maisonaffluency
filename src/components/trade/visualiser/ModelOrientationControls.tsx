import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_MODEL_ORIENTATION, rotateModelOrientation, type ModelOrientation } from "@/lib/modelOrientation";

type Props = {
  orientation?: ModelOrientation;
  onChange: (orientation: ModelOrientation) => void;
  onReset: () => void;
};

export default function ModelOrientationControls({ orientation, onChange, onReset }: Props) {
  const current = orientation ?? DEFAULT_MODEL_ORIENTATION;
  return <TooltipProvider delayDuration={200}>
    <div className="mt-4 border-t border-border pt-3" role="group" aria-label="Model orientation">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase text-muted-foreground">Model orientation</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Reset model orientation" onClick={onReset}><RotateCcw /></Button>
          </TooltipTrigger>
          <TooltipContent className="z-[80]">Reset to imported orientation</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map(axis => <div key={axis} className="min-w-0 text-center">
          <span className="text-xs text-muted-foreground">{axis}</span>
          <div className="mt-1 flex justify-center gap-1">
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
    </div>
  </TooltipProvider>;
}