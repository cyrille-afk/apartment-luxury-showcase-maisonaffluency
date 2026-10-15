import { Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_WALL_FINISHES, type FeatureWallFinish } from "@/lib/visualiserFeatureWall";

const microLabel = "text-[10px] uppercase tracking-[0.15em]";

const ORDER: FeatureWallFinish[] = ["travertine", "microcement", "raw-concrete"];

/** Feature-wall surface picker — travertine, microcement or raw concrete. */
export default function FeatureWallControls({ className, finish, disabled, onChange }: {
  className?: string;
  finish: FeatureWallFinish;
  disabled?: boolean;
  onChange: (finish: FeatureWallFinish) => void;
}) {
  const label = FEATURE_WALL_FINISHES[finish].label;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={cn(className, "whitespace-nowrap")} disabled={disabled} aria-label="Feature wall finish">
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
  );
}
