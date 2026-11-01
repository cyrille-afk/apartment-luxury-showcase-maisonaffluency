import { useState } from "react";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type RoomFacet = "category" | "designer" | "leadTime" | "craft" | "handmade" | "material";
export type RoomFacetValues = Record<RoomFacet, string | null>;
export type RoomFacetOptions = Record<RoomFacet, string[]>;

export function CollectionFilterTrigger({ open, onClick }: { open: boolean; onClick: () => void }) {
  // Open state mirrors the active grid-density capsule: solid foreground pill,
  // background-colored text/icon. Closed state is the borderless text default.
  return <Button variant="ghost" onClick={onClick} aria-expanded={open} aria-label={open ? "Collapse filters" : "Expand filters"} className={cn(
    "hidden h-[41px] shrink-0 items-center gap-2 rounded-full font-body text-[11px] font-medium uppercase tracking-wider transition-all md:inline-flex",
    open ? "bg-foreground px-4 text-background hover:bg-foreground hover:text-background" : "px-0 text-foreground",
  )}>
    {open ? <X className="size-[15px]" strokeWidth={1.5} /> : <SlidersHorizontal className="size-[15px]" strokeWidth={1.5} />} {open ? "Close Filters" : "Filters"}
  </Button>;
}

// Trade sourcing order: lead time first (opens by default), then categories, then materials.
const FACETS: { key: RoomFacet; label: string }[] = [
  { key: "leadTime", label: "Production Lead Time" },
  { key: "category", label: "Categories" },
  { key: "material", label: "Materials" },
  { key: "designer", label: "Designers/Artists" },
  { key: "craft", label: "Craft Type" },
  { key: "handmade", label: "Handcrafted in" },
];

export default function RoomCollectionFilters({
  options, availableMaterials, catalogMaterials, values, onChange, onClear, open: openProp, onOpenChange, fullCatalogue = false, facets, toolbarTrigger = false,
}: {
  facets?: RoomFacet[];
  toolbarTrigger?: boolean;
  open?: boolean;
  fullCatalogue?: boolean;
  onOpenChange?: (open: boolean) => void;
  options: RoomFacetOptions;
  availableMaterials: Set<string>;
  catalogMaterials: Set<string>;
  values: RoomFacetValues;
  onChange: (key: RoomFacet, value: string | null) => void;
  onClear: () => void;
}) {
  // Drawer starts closed on every page; only the FILTERS toggle shows until clicked.
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v); };
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Object.values(values).filter(Boolean).length;

  const content = (
    <>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={!activeCount} className="mb-2 h-8 justify-start gap-2 px-0 font-body text-[10px] uppercase tracking-wider text-foreground disabled:opacity-40">
        <X className="size-4" /> Clear All Filters {activeCount > 0 && `(${activeCount})`}
      </Button>
      <Accordion type="multiple" defaultValue={["leadTime"]} className="w-full">
        {FACETS.filter(({ key }) => facets ? facets.includes(key) : key !== "craft").map(({ key, label }) => (
          <AccordionItem key={key} value={key} className="border-transparent">
            <AccordionTrigger className="py-3 text-left font-body text-[11px] font-medium uppercase tracking-wider text-foreground hover:no-underline [&>svg]:size-3">
              {label}{values[key] && <span className="ml-auto mr-2 size-1.5 rounded-full bg-primary" />}
            </AccordionTrigger>
            <AccordionContent className="max-h-56 overflow-y-auto pb-2">
              {options[key].length ? options[key].map((value) => (
                <label key={value} className={`flex items-start gap-2 py-1.5 font-body text-xs ${key === "material" && !availableMaterials.has(value) ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer text-foreground"}`}>
                  <Checkbox checked={values[key] === value} disabled={key === "material" && !availableMaterials.has(value)} onCheckedChange={() => onChange(key, values[key] === value ? null : value)} className="mt-0.5 size-4 rounded-none" />
                  <span className="min-w-0 flex-1 break-words">{value}</span>
                   {key === "material" && !availableMaterials.has(value) && <span className="shrink-0 text-[9px] text-muted-foreground">{catalogMaterials.has(value) ? fullCatalogue ? "None in this selection" : "None in this room" : "No pieces yet"}</span>}
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
      <aside id={fullCatalogue ? "catalogue-filters" : undefined} aria-label="Collection filters" aria-hidden={!open && (fullCatalogue || toolbarTrigger) ? true : undefined} className={`hidden shrink-0 overflow-hidden transition-[width] duration-350 motion-reduce:transition-none md:block ${open ? "w-48 lg:w-56" : fullCatalogue || toolbarTrigger ? "w-0" : "w-10"}`}>
        <div className="sticky top-[calc(var(--header-h)+1rem)] max-h-[calc(100vh-var(--header-h)-2rem)] overflow-y-auto bg-background pr-2">
          {!fullCatalogue && !toolbarTrigger && <Button variant="ghost" size="icon-sm" onClick={() => setOpen(!open)} title={open ? "Collapse filters" : "Expand filters"} aria-label={open ? "Collapse filters" : "Expand filters"} className="mb-3">
            {open ? <ChevronRight className="rotate-180" /> : <SlidersHorizontal />}
          </Button>}
          {open && content}
        </div>
      </aside>
    </>
  );
}