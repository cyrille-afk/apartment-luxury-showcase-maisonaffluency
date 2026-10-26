import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

export function ComparatorSelectionDrawer({ count, children, open: controlledOpen }: { count: number; children: ReactNode; open?: boolean }) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = controlledOpen ?? expanded ?? count === 0;
  return <Collapsible open={open} onOpenChange={setExpanded} className={controlledOpen === undefined ? "border-y border-border" : ""}>
    {controlledOpen === undefined && <div className="flex min-h-14 items-center justify-between gap-3 py-3">
      <span className="font-body text-xs font-medium text-foreground">{count ? `${count}/4 Pieces Selected` : "Filter & Add Products"}</span>
      <Button variant="outline" size="sm" aria-expanded={open} aria-controls="comparator-selection-drawer" onClick={() => setExpanded(!open)} className="h-9 gap-2 font-body text-xs font-medium">
        {open ? <Check className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
        {open ? "Done" : "Modify Selection"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </Button>
    </div>}
    <CollapsibleContent id="comparator-selection-drawer" className="py-3">{children}</CollapsibleContent>
  </Collapsible>;
}