import type { FelixQuoteFinish } from "@/lib/felixQuoteFinishes";

export function FelixFinishRows({ finishes }: { finishes: FelixQuoteFinish[] }) {
  return <div className="space-y-1">
    {finishes.map((finish, index) => <div key={`${finish.label}-${index}`} className="flex items-center gap-2 font-body text-[10px]">
      {finish.imageUrl && <img src={finish.imageUrl} alt={`${finish.name} swatch`} className="h-7 w-7 shrink-0 object-cover border border-border" loading="lazy" />}
      <span className="min-w-0 break-words text-foreground"><span className="text-muted-foreground">{finish.label}: </span>{finish.name}</span>
    </div>)}
  </div>;
}