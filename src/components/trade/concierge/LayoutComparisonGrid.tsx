import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type LayoutOption = {
  id: number;
  name: string;
  focus: string;
  alignment: string;
  clearance: string;
  itemCount: number;
};

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 1,
    name: "The Curated Classic",
    focus: "Symmetrical placement, maximised flow, heritage pieces foregrounded.",
    alignment: "Primary seating mirrored on a central axis, anchored by the principal case piece",
    clearance: "1,050 mm circulation on all primary routes",
    itemCount: 14,
  },
  {
    id: 2,
    name: "The Modernist Lounge",
    focus: "Relaxed zoning, low-slung silhouettes, connection to the architectural landscape.",
    alignment: "Low sofa run set parallel to the glazing, side tables floated off-wall",
    clearance: "1,200 mm circulation between zones",
    itemCount: 11,
  },
  {
    id: 3,
    name: "The Avant-Garde Atelier",
    focus: "Bold sculptural focal points and dynamic, conversational seating.",
    alignment: "Off-axis sculptural chairs orbiting a single statement centrepiece",
    clearance: "900 mm circulation, widened to 1,300 mm at the focal approach",
    itemCount: 16,
  },
];

export function LayoutComparisonGrid({
  selected,
  onSelect,
}: {
  selected?: number | null;
  onSelect?: (option: LayoutOption) => void;
}) {
  return (
    <div className="w-full animate-fade-in">
      <div className="mb-3 font-body text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
        Proposed Spatial Configurations
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {LAYOUT_OPTIONS.map((option) => {
          const isActive = selected === option.id;
          const isDimmed = !!selected && !isActive;
          return (
            <div
              key={option.id}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-background transition-all duration-300",
                isActive
                  ? "border-foreground shadow-[0_8px_28px_-16px_hsl(var(--foreground)/0.5)]"
                  : "border-border hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.45)]",
                isDimmed && "opacity-55",
              )}
            >
              <div className="flex items-center justify-between gap-2 bg-foreground px-3 py-2.5 text-background">
                <div>
                  <div className="font-body text-[10px] uppercase tracking-[0.24em] opacity-70">
                    Option {option.id}
                  </div>
                  <div className="font-serif text-sm leading-tight">{option.name}</div>
                </div>
                {isActive && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </div>

              <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                <p className="font-body text-xs leading-relaxed text-muted-foreground">{option.focus}</p>
                <ul className="space-y-1.5 font-body text-xs leading-relaxed text-foreground">
                  <li className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>
                      <span className="text-muted-foreground">Primary alignment — </span>
                      {option.alignment}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>
                      <span className="text-muted-foreground">Circulation clearance — </span>
                      {option.clearance}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>
                      <span className="text-muted-foreground">Total trade items — </span>
                      {option.itemCount} pieces
                    </span>
                  </li>
                </ul>
              </div>

              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => onSelect?.(option)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full rounded-full border px-3 py-2 font-body text-[11px] uppercase tracking-[0.18em] transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground hover:bg-accent/10",
                  )}
                >
                  {isActive ? (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Check className="h-3 w-3" /> Configuration Selected
                    </span>
                  ) : (
                    "Select Configuration Layout"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LayoutComparisonGrid;
