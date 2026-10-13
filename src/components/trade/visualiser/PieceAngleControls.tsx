import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  /** Current placement yaw in radians (object.rotation[1]). */
  yaw: number;
  onChange: (yaw: number) => void;
};

const toDegrees = (radians: number) => {
  const degrees = Math.round((radians * 180) / Math.PI) % 360;
  return (degrees + 360) % 360;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Facing-direction control: turns the whole piece on the floor plane.
 * This is the control for "angling" a piece — Model Orientation below it
 * only exists to repair badly imported 3D files.
 */
export default function PieceAngleControls({ yaw, onChange }: Props) {
  const degrees = toDegrees(yaw);
  const step = (delta: number) => onChange(toRadians((degrees + delta + 360) % 360));
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-4 border-t border-border pt-3" role="group" aria-label="Piece angle">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase text-muted-foreground">Piece angle</p>
          <span className="text-xs tabular-nums text-muted-foreground">{degrees}°</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {([-45, 45] as const).map((delta) => (
            <Tooltip key={delta}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Turn piece ${delta === 45 ? "right" : "left"} 45 degrees`}
                  onClick={() => step(delta)}
                >
                  {delta === 45 ? <RotateCw /> : <RotateCcw />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-[80]">{delta === 45 ? "+45°" : "−45°"}</TooltipContent>
            </Tooltip>
          ))}
          <Slider
            aria-label="Piece angle degrees"
            min={0}
            max={359}
            step={1}
            value={[degrees]}
            onValueChange={([value]) => onChange(toRadians(value))}
            className="flex-1"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
