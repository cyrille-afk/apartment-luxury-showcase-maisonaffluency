import React, { useState, useEffect } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";

interface CategorySidebarProps {
  activeCategory: string | null;
  activeSubcategory: string | null;
  onSelect: (category: string | null, subcategory: string | null) => void;
  className?: string;
  itemCounts?: Record<string, number>;
  sectionLabel?: string;
  onOpenChange?: (open: boolean) => void;
  isOpen?: boolean;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({ activeCategory, activeSubcategory, onSelect, className, itemCounts, sectionLabel, onOpenChange, isOpen: controlledOpen }) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
  };

  // Expand parent category accordion when a subcategory is selected (don't force sidebar open)
  useEffect(() => {
    if (activeSubcategory) {
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

  if (!isOpen) return null;

  return (
    <aside className={cn("hidden md:flex flex-col shrink-0 pr-1 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pt-4 w-44 lg:w-48", className)}>
      {/* Categories heading + Clear All */}
      <div className="flex items-center justify-between mb-3 pl-1 pr-0.5">
        <span className="font-body text-[11px] uppercase tracking-[0.2em] text-foreground font-semibold">
          Categories
        </span>
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
    </aside>
  );
};

export default CategorySidebar;
