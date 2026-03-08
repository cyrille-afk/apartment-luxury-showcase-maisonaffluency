import React, { useState, useEffect } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
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
  className?: string;
  itemCounts?: Record<string, number>;
  sectionLabel?: string;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ activeCategory, activeSubcategory, onSelect, className, itemCounts, sectionLabel }) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open sidebar and expand parent category when a subcategory is selected
  useEffect(() => {
    if (activeSubcategory) {
      setIsOpen(true);
      // Find and expand parent category
      const parentCat = CATEGORY_ORDER.find(cat => SUBCATEGORY_MAP[cat]?.includes(activeSubcategory));
      if (parentCat) {
        setExpandedCats(prev => {
          const next = new Set(prev);
          next.add(parentCat);
          return next;
        });
      }
    }
  }, [activeSubcategory]);

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

  // Count active filters
  const activeCount = activeSubcategory ? 1 : (activeCategory ? 1 : 0);

  return (
    <aside className={cn("hidden md:flex flex-col shrink-0 pr-1 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto absolute right-full mr-4 pt-4", isOpen ? "w-44 lg:w-48" : "w-auto", className)}>
      {/* Collapsed state: Filter button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors px-1 py-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[hsl(var(--accent))] text-white text-[9px] font-bold leading-none px-1">
              {activeCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded state: full sidebar */}
      {isOpen && (
        <>
          {/* Categories heading + Clear All */}
          <div className="flex items-center justify-between mb-3 pl-1 pr-0.5">
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-foreground hover:text-muted-foreground transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-semibold">Filter</span>
              {activeCount > 0 && (
                <span className="ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[hsl(var(--accent))] text-white text-[9px] font-bold leading-none px-1">
                  {activeCount}
                </span>
              )}
            </button>
            <button
              onClick={handleClearAll}
              className={cn(
                "px-5 py-1.5 rounded-full border font-body text-xs transition-all duration-300",
                hasActiveFilter
                  ? "bg-white border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] text-foreground"
                  : "bg-white/60 border-border/40 text-muted-foreground/50 cursor-default"
              )}
            >
              Clear All
            </button>
          </div>

          {/* Category list */}
          <nav className="flex flex-col animate-in slide-in-from-left-2 duration-200">
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
                      className="h-[18px] w-[18px] rounded-none border-2 border-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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
                        "flex-1 font-body text-[11px] uppercase tracking-[0.2em] cursor-pointer transition-colors",
                        isActiveCat ? "text-foreground font-semibold" : "text-foreground hover:text-foreground"
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
                      {subs.map(sub => {
                        const isActiveSub = activeSubcategory === sub && activeCategory === cat;
                        return (
                          <div key={sub} className="flex items-center gap-2.5 py-1.5">
                            <Checkbox
                              checked={isActiveSub}
                              onCheckedChange={() => {
                                if (isActiveSub) {
                                  onSelect(cat, null);
                                } else {
                                  onSelect(cat, sub);
                                }
                              }}
                              className="h-4 w-4 rounded-none border-2 border-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <span
                              onClick={() => {
                                if (isActiveSub) {
                                  onSelect(cat, null);
                                } else {
                                  onSelect(cat, sub);
                                }
                              }}
                              className={cn(
                                "font-body text-[10px] tracking-[0.15em] cursor-pointer transition-colors",
                                isActiveSub
                                  ? "text-[hsl(var(--accent))] font-semibold"
                                  : "text-foreground hover:text-foreground"
                              )}
                            >
                              {sub}
                              {itemCounts && itemCounts[sub] !== undefined && isActiveSub && (
                                <span className="ml-1.5 text-[9px] text-muted-foreground/60 font-normal">
                                  ({itemCounts[sub]})
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );
};

export default CategorySidebar;
