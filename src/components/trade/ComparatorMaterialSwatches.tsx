import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { comparatorSwatches, splitComparatorSwatches, type ComparatorSwatch } from "@/lib/comparatorSwatches";

function FinishSwatch({ swatch }: { swatch: ComparatorSwatch }) {
  const [failed, setFailed] = useState(false);
  const image = swatch.imageUrl && !failed;
  const initials = swatch.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <Tooltip><TooltipTrigger asChild>
    <Button type="button" variant="ghost" size="icon" aria-label={swatch.name} className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border bg-muted p-0 text-muted-foreground transition-transform duration-150 hover:scale-105 hover:ring-1 hover:ring-border focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100">
      {image ? <img src={swatch.imageUrl || undefined} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : swatch.color ? <span className="h-full w-full" style={{ backgroundColor: swatch.color }} /> : <span className="font-body text-[9px] font-medium">{initials}</span>}
    </Button>
  </TooltipTrigger><TooltipContent className="max-w-64 font-body text-xs leading-relaxed">{swatch.name}{!image && !swatch.color && <span className="block text-xs opacity-70">Sample image unavailable</span>}</TooltipContent></Tooltip>;
}

export function ComparatorMaterialSwatches({ materials, linked = [], loading = false }: { materials: string; linked?: ComparatorSwatch[]; loading?: boolean }) {
  const { visible, more } = splitComparatorSwatches(comparatorSwatches(materials, linked));
  if (!visible.length) return <span>{loading ? "Loading finishes…" : "—"}</span>;
  return <div className="flex flex-wrap items-center gap-2" aria-label="Material swatches" aria-busy={loading}>
    {visible.map(swatch => <FinishSwatch key={swatch.id} swatch={swatch} />)}
    {!!more.length && <Popover><PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="sm" className="h-7 rounded-none px-1 font-body text-xs font-normal text-muted-foreground hover:text-foreground" aria-label={`Show ${more.length} more finishes`}>+{more.length} more</Button>
    </PopoverTrigger><PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] p-3">
      <div className="mb-3 font-body text-xs font-medium text-popover-foreground">Additional finishes</div>
      <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto p-1" aria-label="Additional material swatches">{more.map(swatch => <FinishSwatch key={swatch.id} swatch={swatch} />)}</div>
    </PopoverContent></Popover>}
  </div>;
}