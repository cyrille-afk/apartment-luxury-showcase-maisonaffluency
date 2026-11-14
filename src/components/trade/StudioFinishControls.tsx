import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { studioFinishGroups, type StudioFinishProduct, type StudioFinishSelection } from "@/lib/studioFinishes";

export function StudioFinishControls({ product, selection, onChange, disabled = false, compact = false }: { product: StudioFinishProduct; selection: StudioFinishSelection; onChange: (selection: StudioFinishSelection) => void; disabled?: boolean; compact?: boolean }) {
  const groups = studioFinishGroups(product);
  const active = groups.flatMap(group => {
    const finish = group.options.find(f => f.id === selection.ids[group.key]);
    return finish ? [finish] : [];
  });
  const activeLabel = active.map(finish => finish.name).join(" · ") || product.materials || "Original catalogue materials · supplier finishes unconfirmed";
  const controls = <div className="min-w-0 space-y-3 text-left" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <div className="flex items-center justify-between gap-2">
      <span className="font-body text-[10px] text-muted-foreground">Material / Finish</span>
      <Button variant="ghost" size="icon" disabled={disabled || !groups.length} className="h-8 w-8 shrink-0 cursor-pointer" aria-label={selection.locked ? "Unlock finish" : "Lock finish"} title={selection.locked ? "Unlock finish" : "Lock finish for 3D export"} aria-pressed={selection.locked} onClick={() => onChange({ ...selection, locked: !selection.locked })}>
        {selection.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5 text-muted-foreground" />}
      </Button>
    </div>
    {groups.map(group => <div key={group.key} className="min-w-0">
      <p className="font-body text-[10px] leading-relaxed text-muted-foreground">{group.label}: <span className="text-foreground">{group.options.find(f => f.id === selection.ids[group.key])?.name}</span></p>
      <div className={`mt-1 flex max-w-full gap-2 p-1 ${compact ? "flex-wrap" : "overflow-x-auto"}`} role="group" aria-label={group.label}>
        {group.options.map(finish => <Button key={finish.id} variant="ghost" size="icon" aria-label={`Select ${finish.name}`} title={finish.name} aria-pressed={selection.ids[group.key] === finish.id} disabled={disabled || selection.locked} className={`h-8 w-8 shrink-0 cursor-pointer overflow-hidden !rounded-full border p-0 ${selection.ids[group.key] === finish.id ? "border-foreground ring-1 ring-foreground ring-offset-2 ring-offset-background" : "border-border"}`} onClick={() => onChange({ ...selection, ids: { ...selection.ids, [group.key]: finish.id } })}>
          {finish.image_url ? <img src={finish.image_url} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="font-body text-[9px] text-muted-foreground">{finish.name.slice(0, 2)}</span>}
        </Button>)}
      </div>
    </div>)}
    {!groups.length && <p className="font-body text-[10px] leading-relaxed text-muted-foreground">{product.materials || "Original catalogue materials · supplier finishes unconfirmed"}</p>}
  </div>;
  if (!compact) return <div className="mt-3">{controls}</div>;
  return <div className="mt-3 min-w-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={!groups.length} aria-label={`Edit finishes for ${product.name}: ${activeLabel}`} title={activeLabel} className="h-9 w-full min-w-0 cursor-pointer justify-start gap-2 rounded-md px-2.5 font-body text-[11px] font-normal">
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {active.map(finish => <span key={finish.id} className="size-3 shrink-0 overflow-hidden !rounded-full border border-border bg-muted">{finish.image_url && <img src={finish.image_url} alt="" className="h-full w-full object-cover" />}</span>)}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{activeLabel}</span>
          {selection.locked ? <Lock className="!size-3 shrink-0" /> : <Unlock className="!size-3 shrink-0 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} aria-label={`Material and finish options for ${product.name}`} className="max-h-[min(28rem,70dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-4" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <p className="mb-2 truncate font-body text-xs text-foreground">{product.name}</p>
        {controls}
      </PopoverContent>
    </Popover>
  </div>;
}