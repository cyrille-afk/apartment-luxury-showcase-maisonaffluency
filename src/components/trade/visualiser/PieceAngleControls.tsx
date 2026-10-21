import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * Layout: label + value, turn buttons, then a full-width slider on its own row.
 */
export default function PieceAngleControls({ yaw, onChange }: Props) {
  const degrees = toDegrees(yaw);
  const step = (delta: number) => onChange(toRadians((degrees + delta + 360) % 360));
  const pct = (degrees / 360) * 100;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3" role="group" aria-label="Piece angle">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase text-muted-foreground">Piece angle</p>
          <div className="flex items-center gap-2">
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
            <span className="w-10 text-right text-xs tabular-nums text-foreground">{degrees}°</span>
          </div>
        </div>
        <input
          type="range"
          aria-label="Piece angle degrees"
          min={0}
          max={360}
          step={1}
          value={degrees}
          onChange={(event) => onChange(toRadians(Number(event.target.value) % 360))}
          style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)` }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full border border-border outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow"
        />
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>0°</span><span>180°</span><span>360°</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
