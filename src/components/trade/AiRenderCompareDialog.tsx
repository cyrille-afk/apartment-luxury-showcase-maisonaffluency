import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, Columns2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  renderKindLabel,
  renderModeLabel,
  type AiRenderHistoryEntry,
} from "@/lib/aiRenderHistory";

interface AiRenderCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: [AiRenderHistoryEntry, AiRenderHistoryEntry] | null;
  onReopen: (entry: AiRenderHistoryEntry) => void;
}

const EntryMeta = ({
  label,
  entry,
  onReopen,
}: {
  label: "A" | "B";
  entry: AiRenderHistoryEntry;
  onReopen: (entry: AiRenderHistoryEntry) => void;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-muted/30 p-3">
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-medium text-background">
          {label}
        </span>
        <span className="font-display text-xs text-foreground">{renderModeLabel(entry.mode)}</span>
        <span className="rounded-full bg-background px-2 py-0.5 font-body text-[10px] text-muted-foreground border border-border">
          {renderKindLabel(entry.kind)}
        </span>
        {entry.style_preset && (
          <span className="rounded-full bg-background px-2 py-0.5 font-body text-[10px] text-muted-foreground border border-border">
            {entry.style_preset}
          </span>
        )}
        <span className="rounded-full bg-background px-2 py-0.5 font-body text-[10px] uppercase text-muted-foreground border border-border">
          {entry.quality_tier}
        </span>
      </div>
      <p className="font-body text-[11px] text-muted-foreground">
        {entry.project_name || "Unassigned"} · {format(new Date(entry.created_at), "d MMM yyyy, HH:mm")}
      </p>
      {entry.prompt_note && (
        <p className="font-body text-xs text-foreground/80 line-clamp-2">{entry.prompt_note}</p>
      )}
    </div>
    <Button variant="outline" size="sm" onClick={() => onReopen(entry)}>
      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reopen {label}
    </Button>
  </div>
);

export function AiRenderCompareDialog({
  open,
  onOpenChange,
  pair,
  onReopen,
}: AiRenderCompareDialogProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "slider">("side-by-side");
  const [swapped, setSwapped] = useState(false);
  const [splitPct, setSplitPct] = useState(50);

  if (!pair) return null;
  const left = swapped ? pair[1] : pair[0];
  const right = swapped ? pair[0] : pair[1];

  const handleReopen = (entry: AiRenderHistoryEntry) => {
    onReopen(entry);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="font-display text-lg">Compare Renders</DialogTitle>
              <DialogDescription className="font-body text-xs">
                Inspect two saved renders side-by-side or drag the split slider, then reopen either version into the studio.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={viewMode === "side-by-side" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("side-by-side")}
              >
                <Columns2 className="w-3.5 h-3.5 mr-1.5" />Side-by-Side
              </Button>
              <Button
                variant={viewMode === "slider" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("slider")}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />Split Slider
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSwapped((prev) => !prev)}>
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />Swap A / B
              </Button>
            </div>
          </div>
        </DialogHeader>

        {viewMode === "side-by-side" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
                <img
                  src={left.result_image_url}
                  alt={`Render A — ${renderModeLabel(left.mode)}`}
                  className="w-full max-h-[55vh] object-contain"
                />
                <span className="absolute top-2 left-2 rounded bg-foreground/85 px-2 py-0.5 font-body text-[10px] font-medium text-background">
                  Render A
                </span>
              </div>
              <EntryMeta label="A" entry={left} onReopen={handleReopen} />
            </div>
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
                <img
                  src={right.result_image_url}
                  alt={`Render B — ${renderModeLabel(right.mode)}`}
                  className="w-full max-h-[55vh] object-contain"
                />
                <span className="absolute top-2 left-2 rounded bg-foreground/85 px-2 py-0.5 font-body text-[10px] font-medium text-background">
                  Render B
                </span>
              </div>
              <EntryMeta label="B" entry={right} onReopen={handleReopen} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20 select-none">
              <img
                src={right.result_image_url}
                alt={`Render B — ${renderModeLabel(right.mode)}`}
                className="w-full max-h-[58vh] object-contain block"
              />
              <img
                src={left.result_image_url}
                alt={`Render A — ${renderModeLabel(left.mode)}`}
                className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
                style={{ left: `${splitPct}%` }}
              />
              <span className="absolute top-2 left-2 rounded bg-foreground/85 px-2 py-0.5 font-body text-[10px] font-medium text-background">
                Render A
              </span>
              <span className="absolute top-2 right-2 rounded bg-foreground/85 px-2 py-0.5 font-body text-[10px] font-medium text-background">
                Render B
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-muted-foreground">Render A</span>
              <input
                type="range"
                min={0}
                max={100}
                value={splitPct}
                onChange={(e) => setSplitPct(Number(e.target.value))}
                aria-label="Comparison split position"
                className="flex-1 accent-primary"
              />
              <span className="font-body text-xs text-muted-foreground">Render B</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EntryMeta label="A" entry={left} onReopen={handleReopen} />
              <EntryMeta label="B" entry={right} onReopen={handleReopen} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}