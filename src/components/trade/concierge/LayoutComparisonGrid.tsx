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

/** Generic fallback used only when no aesthetic DNA was captured. */
const FALLBACK_STYLE = "Curated";

/**
 * Normalises the free-text "Aesthetic & Visual DNA" (VIBE) input into a short
 * style modifier usable as a naming prefix, e.g. "Art Deco", "Japandi-Luxe".
 */
export function normaliseStyleInput(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[[\]]/g, " ")
    .replace(/\b(?:e\.?g\.?|for example|such as|inspired by|style|vibe|aesthetic)\b/gi, " ")
    .trim();
  // Take the first declared concept only.
  s = s.split(/[,;/|·—–]|\band\b|\bwith\b|\bplus\b/i)[0] ?? "";
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  const words = s.split(" ").slice(0, 3);
  return words
    .map((w) =>
      w
        .split("-")
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
        .join("-"),
    )
    .join(" ");
}

/**
 * Derives the three spatial strategy variants from the captured design era.
 * Titles and editorial copy are generated — never hardcoded per option.
 */
export function deriveLayoutOptions(styleInput?: string | null): LayoutOption[] {
  const style = normaliseStyleInput(styleInput) || FALLBACK_STYLE;
  const hasStyle = !!normaliseStyleInput(styleInput);
  const era = hasStyle ? style : "the referenced period";

  return [
    {
      id: 1,
      name: `The ${style} Classic`,
      focus: `Faithful ${era} symmetry: axial placement, maximised flow, heritage pieces foregrounded.`,
      alignment: `Primary seating mirrored on a central axis, anchored by the principal ${era} case piece`,
      clearance: "1,050 mm circulation on all primary routes",
      itemCount: 14,
    },
    {
      id: 2,
      name: `Zoned ${style}`,
      focus: `A fluid re-reading of ${era}: relaxed zoning, streamlined silhouettes, connection to the architectural landscape.`,
      alignment: "Low seating run set parallel to the glazing, occasional pieces floated off-wall",
      clearance: "1,200 mm circulation between zones",
      itemCount: 11,
    },
    {
      id: 3,
      name: `The Progressive ${style} Atelier`,
      focus: `A sculptural, progressive interpretation of ${era}: bold focal points and dynamic, conversational seating.`,
      alignment: "Off-axis sculptural chairs orbiting a single statement centrepiece",
      clearance: "900 mm circulation, widened to 1,300 mm at the focal approach",
      itemCount: 16,
    },
  ];
}

/** Default set (no aesthetic DNA captured). */
export const LAYOUT_OPTIONS: LayoutOption[] = deriveLayoutOptions();

export function LayoutComparisonGrid({
  selected,
  onSelect,
  options,
  styleInput,
}: {
  selected?: number | null;
  onSelect?: (option: LayoutOption) => void;
  options?: LayoutOption[];
  styleInput?: string | null;
}) {
  const layoutOptions = options ?? deriveLayoutOptions(styleInput);
  return (
    <div className="w-full animate-fade-in">
      <div className="mb-3 font-body text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
        Proposed Spatial Configurations
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {layoutOptions.map((option) => {
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
                    "w-full rounded-full border px-2 py-2 font-body text-[10px] uppercase tracking-[0.14em] transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground hover:bg-accent/10",
                  )}
                >
                  {isActive ? (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Check className="h-3 w-3" /> Selected
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
