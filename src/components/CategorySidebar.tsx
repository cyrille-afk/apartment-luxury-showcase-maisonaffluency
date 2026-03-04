import React, { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
  "Storage": ["Bookcases", "Cabinets"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
};

interface CategorySidebarProps {
  activeCategory: string | null;
  activeSubcategory: string | null;
  onSelect: (category: string | null, subcategory: string | null) => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ activeCategory, activeSubcategory, onSelect }) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleExpand = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleClearAll = () => {
    onSelect(null, null);
  };

  const hasActiveFilter = activeCategory || activeSubcategory;
  const hasSubs = (cat: string) => (SUBCATEGORY_MAP[cat]?.length ?? 0) > 0;

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-60 shrink-0 pr-6 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pt-[14.5rem]">
      {/* Clear All pill — vertically aligned with A-Z bar */}
      <div className="mb-5">
        <button
          onClick={handleClearAll}
          className={cn(
            "px-5 py-1.5 rounded-full border text-[11px] font-body uppercase tracking-[0.15em] transition-all duration-300",
            hasActiveFilter
              ? "border-border/30 text-foreground/70 hover:text-primary bg-transparent"
              : "border-border/30 text-foreground/20 cursor-default bg-transparent"
          )}
        >
          Clear All
        </button>
      </div>

      {/* Categories heading */}
      <h4 className="font-serif text-sm text-foreground mb-3 pl-1">Categories</h4>

      {/* Category list */}
      <nav className="flex flex-col">
        {CATEGORY_ORDER.map(cat => {
          const isExpanded = expandedCats.has(cat);
          const isActiveCat = activeCategory === cat;
          const subs = SUBCATEGORY_MAP[cat] || [];
          const hasSubcats = hasSubs(cat);

          return (
            <div key={cat} className="border-b border-border/20 last:border-b-0">
              {/* Category row */}
              <div className="flex items-center gap-3 py-3 px-1">
                <Checkbox
                  checked={isActiveCat}
                  onCheckedChange={() => {
                    if (isActiveCat) {
                      onSelect(null, null);
                    } else {
                      onSelect(cat, null);
                    }
                  }}
                  className="h-4.5 w-4.5 rounded-sm border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span
                  onClick={() => {
                    if (isActiveCat) {
                      onSelect(null, null);
                    } else {
                      onSelect(cat, null);
                    }
                  }}
                  className={cn(
                    "flex-1 font-body text-sm tracking-wide cursor-pointer transition-colors",
                    isActiveCat ? "text-foreground font-medium" : "text-foreground/80 hover:text-foreground"
                  )}
                >
                  {cat}
                </span>
                {hasSubcats && (
                  <button
                    onClick={() => toggleExpand(cat)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                )}
              </div>

              {/* Subcategories */}
              {isExpanded && subs.length > 0 && (
                <div className="ml-8 pl-3 border-l border-border/30 flex flex-col gap-0.5 pb-3">
                  {subs.map(sub => (
                    <button
                      key={sub}
                      onClick={() => onSelect(cat, sub)}
                      className={cn(
                        "text-left py-1.5 font-body text-[12px] tracking-wide transition-colors",
                        activeSubcategory === sub && activeCategory === cat
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default CategorySidebar;
