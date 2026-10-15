import { useState } from "react";
import { Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FEATURE_WALL_FINISHES, type FeatureWallFinish } from "@/lib/visualiserFeatureWall";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

const ORDER: FeatureWallFinish[] = ["travertine", "microcement", "raw-concrete"];

const FINISH_NAMES = ORDER.map((id) => FEATURE_WALL_FINISHES[id].label).join(", ");
const FINISH_TIP = `Click to switch the feature wall between ${FINISH_NAMES}.`;
const BACKDROP_TIP =
  "A room photo is loaded, so the photo is the backdrop and the wall stays hidden. Remove the photo to switch finishes.";

/** Feature-wall surface picker — travertine, microcement or raw concrete. */
export default function FeatureWallControls({ className, finish, disabled, onChange }: {
  className?: string;
  finish: FeatureWallFinish;
  disabled?: boolean;
  onChange: (finish: FeatureWallFinish) => void;
}) {
  const label = FEATURE_WALL_FINISHES[finish].label;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={tipOpen && !popoverOpen} onOpenChange={setTipOpen}>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
            <Popover
              onOpenChange={(open) => {
                setPopoverOpen(open);
                if (open) setTipOpen(false);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(className, "whitespace-nowrap", disabled && "pointer-events-none")}
                  disabled={disabled}
                  aria-label="Feature wall finish"
                >
                  <Layers className="mr-2 h-3.5 w-3.5" /> Wall: {label}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-64">
                <p className={cn(microLabel, "mb-2 text-muted-foreground")}>Feature wall finish</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={finish === id}
                      onClick={() => onChange(id)}
                      className={cn(
                        "rounded-md border px-1 py-2 text-center text-[11px] leading-tight transition-colors",
                        finish === id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {FEATURE_WALL_FINISHES[id].label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[80] max-w-64">
          {disabled ? BACKDROP_TIP : FINISH_TIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
