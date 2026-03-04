import React, { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <aside className="hidden md:flex flex-col w-48 lg:w-52 shrink-0 border-r border-border/40 py-4 pr-4 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          Filter by Category
        </span>
        {hasActiveFilter && (
          <button
            onClick={handleClearAll}
            className="font-body text-[9px] uppercase tracking-[0.15em] text-primary hover:text-primary/70 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Categories */}
      <nav className="flex flex-col gap-0.5">
        {CATEGORY_ORDER.map(cat => {
          const isExpanded = expandedCats.has(cat);
          const isActiveCat = activeCategory === cat;
          const subs = SUBCATEGORY_MAP[cat] || [];

          return (
            <div key={cat}>
              {/* Category header row */}
              <button
                onClick={() => toggleExpand(cat)}
                className={cn(
                  "w-full flex items-center justify-between py-2 px-1 font-body text-[11px] uppercase tracking-[0.15em] transition-colors rounded",
                  isActiveCat && !activeSubcategory
                    ? "text-primary font-semibold"
                    : "text-foreground/80 hover:text-primary"
                )}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(cat, null);
                  }}
                  className="cursor-pointer"
                >
                  {cat}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Subcategories */}
              {isExpanded && subs.length > 0 && (
                <div className="ml-2 border-l border-border/30 pl-3 flex flex-col gap-0.5 pb-1">
                  {subs.map(sub => (
                    <button
                      key={sub}
                      onClick={() => onSelect(cat, sub)}
                      className={cn(
                        "text-left py-1 font-body text-[10px] uppercase tracking-[0.12em] transition-colors",
                        activeSubcategory === sub && activeCategory === cat
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:text-primary"
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
