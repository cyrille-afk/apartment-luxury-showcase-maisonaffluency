import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import designersIndex from "@/data/designersIndex.json";
import brandCategoriesRaw from "@/data/brandCategories.json";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Designer = { slug: string; name: string };

export type BrandCategory =
  | "all"
  | "seating"
  | "lighting"
  | "tables"
  | "storage"
  | "rugs"
  | "decor"
  | "bedroom";

const BRAND_CATEGORIES: Record<Exclude<BrandCategory, "all">, string[]> =
  brandCategoriesRaw as Record<Exclude<BrandCategory, "all">, string[]>;

const CATEGORY_LABELS: { key: BrandCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "seating", label: "Seating" },
  { key: "lighting", label: "Lighting" },
  { key: "tables", label: "Tables" },
  { key: "storage", label: "Storage" },
  { key: "rugs", label: "Rugs" },
  { key: "decor", label: "Decor" },
  { key: "bedroom", label: "Bedroom" },
];

const ALL_BRANDS: string[] = (designersIndex as Designer[])
  .map((designer) => designer.name)
  .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

function poolForCategory(category: BrandCategory): string[] {
  if (category === "all") return ALL_BRANDS;
  const names = new Set((BRAND_CATEGORIES[category] ?? []).map((name) => name.toLowerCase()));
  return ALL_BRANDS.filter((brand) => names.has(brand.toLowerCase()));
}

function stripBrandQualifier(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function parseSelected(value: string): string[] {
  if (!value.trim()) return [];
  const out: string[] = [];
  let buffer = "";
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "/" && depth === 0) {
      const name = stripBrandQualifier(buffer);
      if (name) out.push(name);
      buffer = "";
    } else {
      buffer += character;
    }
  }
  const finalName = stripBrandQualifier(buffer);
  if (finalName) out.push(finalName);
  const seen = new Set<string>();
  return out.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatSelected(names: string[]): string {
  return names.join(" / ");
}

export function BrandPicker({
  value,
  onChange,
  defaultCategory = "all",
}: {
  value: string;
  onChange: (next: string) => void;
  defaultCategory?: BrandCategory;
}) {
  const selected = useMemo(() => parseSelected(value), [value]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BrandCategory>(defaultCategory);
  const [draftSelection, setDraftSelection] = useState<string[]>(selected);

  const visibleBrands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return poolForCategory(category).filter(
      (brand) => !normalizedQuery || brand.toLowerCase().includes(normalizedQuery),
    );
  }, [category, query]);

  const groupedBrands = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const brand of visibleBrands) {
      const firstCharacter = brand.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstCharacter) ? firstCharacter : "#";
      const group = groups.get(letter) ?? [];
      group.push(brand);
      groups.set(letter, group);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleBrands]);

  const openDirectory = () => {
    setDraftSelection(selected);
    setQuery("");
    setOpen(true);
  };

  const toggleDraftBrand = (name: string) => {
    const exists = draftSelection.some((brand) => brand.toLowerCase() === name.toLowerCase());
    setDraftSelection(
      exists
        ? draftSelection.filter((brand) => brand.toLowerCase() !== name.toLowerCase())
        : [...draftSelection, name],
    );
  };

  const removeSelected = (name: string) => {
    onChange(formatSelected(selected.filter((brand) => brand.toLowerCase() !== name.toLowerCase())));
  };

  const applySelection = () => {
    onChange(formatSelected(draftSelection));
    setOpen(false);
  };

  return (
    <div className="block sm:col-span-2">
      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        References (in-catalogue brands)
      </span>

      <div className="mt-1 flex min-h-10 flex-wrap items-center gap-1.5 border border-border bg-background px-2.5 py-2">
        {selected.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 border border-accent/40 bg-accent/10 px-2 py-1 font-body text-[11px] text-accent"
          >
            {name}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeSelected(name)}
              className="h-4 w-4 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${name}`}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </span>
        ))}
        <Button
          type="button"
          variant="link"
          onClick={openDirectory}
          className="h-auto px-1 py-1 font-body text-[11px] uppercase tracking-[0.1em] text-accent"
        >
          + Browse A–Z Directory
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideClose
          className="flex h-[min(86vh,780px)] w-[94vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-sm border-border p-0 shadow-xl"
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 pb-5 pt-6 text-left sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <DialogTitle className="font-heading text-xl font-normal tracking-[0.04em] text-foreground sm:text-2xl">
                  Select Curated Ateliers &amp; Brands
                </DialogTitle>
                <DialogDescription className="mt-2 font-body text-[11px] uppercase tracking-[0.14em]">
                  Browse the Maison Affluency catalogue directory
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 border border-border bg-background px-3 lg:w-80">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="sr-only">Search brands</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search ateliers and brands"
                    className="min-w-0 flex-1 bg-transparent font-body text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 rounded-sm"
                  aria-label="Close brand directory"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Filter brands by category">
              {CATEGORY_LABELS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={category === item.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(item.key)}
                  className="h-7 rounded-full px-3 font-body text-[9px] uppercase tracking-[0.12em]"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            {groupedBrands.length > 0 ? (
              <div className="columns-1 gap-10 sm:columns-2 lg:columns-3 xl:columns-4">
                {groupedBrands.map(([letter, brands]) => (
                  <section key={letter} className="mb-8 break-inside-avoid">
                    <h3 className="mb-3 border-b border-border pb-2 font-heading text-xl font-semibold text-accent">
                      {letter}
                    </h3>
                    <div className="space-y-1">
                      {brands.map((brand) => {
                        const checked = draftSelection.some(
                          (selectedBrand) => selectedBrand.toLowerCase() === brand.toLowerCase(),
                        );
                        return (
                          <label
                            key={brand}
                            className="flex cursor-pointer items-center gap-2.5 py-1.5 font-body text-xs text-foreground transition-colors hover:text-accent"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleDraftBrand(brand)}
                              aria-label={`Select ${brand}`}
                              className="h-3.5 w-3.5 rounded-none border-muted-foreground/50"
                            />
                            <span>{brand}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center font-body text-xs uppercase tracking-[0.12em] text-muted-foreground">
                No catalogue brands match this search
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-6 py-4 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  {draftSelection.length} {draftSelection.length === 1 ? "Brand" : "Brands"} Selected
                </p>
                <p className="mt-1 truncate font-body text-[11px] text-muted-foreground">
                  {draftSelection.length > 0 ? draftSelection.join(" · ") : "No ateliers selected"}
                </p>
              </div>
              <Button
                type="button"
                onClick={applySelection}
                className="h-10 shrink-0 rounded-sm px-7 font-body text-[10px] uppercase tracking-[0.14em]"
              >
                Apply Selection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}