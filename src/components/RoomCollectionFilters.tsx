import { useState } from "react";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type RoomFacet = "category" | "designer" | "leadTime" | "handmade" | "material";
export type RoomFacetValues = Record<RoomFacet, string | null>;
export type RoomFacetOptions = Record<RoomFacet, { value: string; count: number }[]>;

const FACETS: { key: RoomFacet; label: string }[] = [
  { key: "category", label: "Categories" },
  { key: "designer", label: "Designers/Artists" },
  { key: "leadTime", label: "Lead Time" },
  { key: "handmade", label: "Handmade" },
  { key: "material", label: "Materials" },
];

export default function RoomCollectionFilters({
  options, values, onChange, onClear, count,
}: {
  options: RoomFacetOptions;
  values: RoomFacetValues;
  onChange: (key: RoomFacet, value: string | null) => void;
  onClear: () => void;
  count: number;
}) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Object.values(values).filter(Boolean).length;

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="font-body text-xs font-semibold uppercase tracking-wider text-foreground">Filters</span>
        <span className="font-body text-xs tabular-nums text-muted-foreground">{count} pieces</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={!activeCount} className="my-2 h-8 justify-start px-0 font-body text-[10px] uppercase tracking-wider text-foreground disabled:opacity-40">
        <X className="size-3" /> Clear All Filters {activeCount > 0 && `(${activeCount})`}
      </Button>
      <Accordion type="multiple" defaultValue={[]} className="w-full">
        {FACETS.map(({ key, label }) => (
          <AccordionItem key={key} value={key} className="border-border">
            <AccordionTrigger className="py-3 text-left font-body text-[11px] font-medium uppercase tracking-wider text-foreground hover:no-underline [&>svg]:size-3">
              {label}{values[key] && <span className="ml-auto mr-2 size-1.5 rounded-full bg-primary" />}
            </AccordionTrigger>
            <AccordionContent className="max-h-56 overflow-y-auto pb-2">
              {options[key].length ? options[key].map(({ value, count: optionCount }) => (
                <label key={value} className="flex cursor-pointer items-start gap-2 py-1.5 font-body text-xs text-foreground">
                  <Checkbox checked={values[key] === value} onCheckedChange={() => onChange(key, values[key] === value ? null : value)} className="mt-0.5 size-4 rounded-none" />
                  <span className="min-w-0 flex-1 break-words">{value}</span>
                  <span className="tabular-nums text-muted-foreground">{optionCount}</span>
                </label>
              )) : <p className="py-2 font-body text-xs text-muted-foreground">No catalogued options</p>}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)} className="mb-5 font-body text-xs md:hidden">
        <SlidersHorizontal className="size-4" /> Filters {activeCount > 0 && `(${activeCount})`}
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="overflow-y-auto pt-16 md:hidden">
          <SheetTitle className="sr-only">Collection filters</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
      <aside aria-label="Collection filters" className={`hidden shrink-0 md:block ${open ? "w-48 lg:w-56" : "w-10"}`}>
        <div className="sticky top-[calc(var(--header-h)+1rem)] max-h-[calc(100vh-var(--header-h)-2rem)] overflow-y-auto pr-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(!open)} title={open ? "Collapse filters" : "Expand filters"} aria-label={open ? "Collapse filters" : "Expand filters"} className="mb-3 border border-border">
            {open ? <ChevronRight className="rotate-180" /> : <SlidersHorizontal />}
          </Button>
          {open && content}
        </div>
      </aside>
    </>
  );
}