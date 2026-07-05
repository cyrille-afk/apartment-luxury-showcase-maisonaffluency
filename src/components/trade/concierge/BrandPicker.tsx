import { useMemo, useRef, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import designersIndex from "@/data/designersIndex.json";
import brandCategoriesRaw from "@/data/brandCategories.json";

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
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

function poolForCategory(cat: BrandCategory): string[] {
  if (cat === "all") return ALL_BRANDS;
  const set = new Set(
    (BRAND_CATEGORIES[cat] ?? []).map((n) => n.toLowerCase())
  );
  return ALL_BRANDS.filter((b) => set.has(b.toLowerCase()));
}

function parseSelected(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BrandCategory>(defaultCategory);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => parseSelected(value), [value]);
  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected]
  );

  const pool = useMemo(() => poolForCategory(category), [category]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = pool.filter((b) => !selectedSet.has(b.toLowerCase()));
    if (!q) return filtered.slice(0, 10);
    return filtered.filter((b) => b.toLowerCase().includes(q)).slice(0, 10);
  }, [pool, query, selectedSet]);

  const add = (name: string) => {
    if (selectedSet.has(name.toLowerCase())) return;
    onChange(formatSelected([...selected, name]));
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (name: string) => {
    onChange(
      formatSelected(selected.filter((s) => s.toLowerCase() !== name.toLowerCase()))
    );
  };

  const commitFreeText = () => {
    const raw = query.trim();
    if (!raw) return;
    add(raw);
  };

  return (
    <label className="block sm:col-span-2">
      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        References (in-catalogue brands)
      </span>
      <div
        className="mt-1 rounded-lg border border-border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-1.5 items-center">
          {selected.map((name) => {
            const inCatalog = ALL_BRANDS.some(
              (b) => b.toLowerCase() === name.toLowerCase()
            );
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-body text-[11px] border ${
                  inCatalog
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-muted text-muted-foreground"
                }`}
                title={inCatalog ? "In catalogue" : "Not in catalogue"}
              >
                {name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(name);
                  }}
                  className="rounded hover:bg-foreground/10 p-0.5"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length > 0) add(suggestions[0]);
                else commitFreeText();
              } else if (e.key === "Backspace" && !query && selected.length > 0) {
                remove(selected[selected.length - 1]);
              }
            }}
            placeholder={selected.length === 0 ? "Search brands…" : ""}
            className="flex-1 min-w-[120px] bg-transparent px-1 py-0.5 font-body text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {open && suggestions.length > 0 && (
          <div className="relative">
            <div className="absolute left-0 right-0 top-1 z-20 max-h-52 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(name)}
                  className="w-full text-left px-2.5 py-1.5 font-body text-[12px] text-foreground hover:bg-accent/10 hover:text-accent"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <span className="mt-1 block font-body text-[10px] text-muted-foreground">
        {selected.length} selected · {ALL_BRANDS.length} brands in catalogue
      </span>
    </label>
  );
}
