/**
 * Single-field A–Z designer/maker picker for the Trade Gallery filter bar.
 *
 * Closed state: shows the current selection (or "All Designers & Makers").
 * Open state: a vertical list of letters. Clicking a letter expands that
 * letter inline to reveal the designers under it; clicking a designer
 * selects it and closes the menu.
 *
 * Accent-folded for grouping (Andrée → A, Félix → F) but the original
 * label with diacritics is preserved in the displayed option.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  brands: string[];
  /** Currently selected brand label, or "all". */
  value: string;
  onChange: (next: string) => void;
  /** Tailwind classes inherited from neighbouring filter selects. */
  selectClassName?: string;
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const initialOf = (label: string): string => {
  const cleaned = stripAccents(label.trim()).toUpperCase();
  const stripped = cleaned
    .replace(/^L['']/, "")
    .replace(/^(LE |LA |LES |THE )/, "");
  const first = stripped.charAt(0);
  return /[A-Z]/.test(first) ? first : "#";
};

const AlphabetDesignerPicker = ({
  brands,
  value,
  onChange,
  selectClassName,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedLetter, setExpandedLetter] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  const { letters, byLetter, letterOf } = useMemo(() => {
    const map = new Map<string, string[]>();
    const lookup = new Map<string, string>();
    for (const b of brands) {
      const L = initialOf(b);
      lookup.set(b, L);
      if (!map.has(L)) map.set(L, []);
      map.get(L)!.push(b);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) =>
        stripAccents(a).localeCompare(stripAccents(b), undefined, {
          sensitivity: "base",
        })
      );
    }
    const letters = Array.from(map.keys()).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
    return { letters, byLetter: map, letterOf: lookup };
  }, [brands]);

  // When opening the menu, jump straight to the letter of the active
  // selection so the user can see context.
  useEffect(() => {
    if (open && value !== "all") {
      const L = letterOf.get(value);
      if (L) setExpandedLetter(L);
    }
    if (!open) setExpandedLetter("");
  }, [open, value, letterOf]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const totalCount = brands.length;
  const buttonLabel =
    value === "all"
      ? `All Designers & Makers (${totalCount})`
      : value;

  const handlePickAll = () => {
    onChange("all");
    setOpen(false);
  };

  const handlePickDesigner = (b: string) => {
    onChange(b);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex-1 sm:flex-none min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          selectClassName,
          "inline-flex items-center justify-between gap-2 text-left w-full sm:w-auto sm:min-w-[16rem]"
        )}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 mt-1 left-0 w-[min(20rem,90vw)] max-h-[min(70vh,28rem)] overflow-y-auto",
            "rounded-md border border-border bg-background shadow-lg",
            "font-body text-sm"
          )}
          role="listbox"
        >
          <button
            type="button"
            onClick={handlePickAll}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/60 transition-colors border-b border-border",
              value === "all" && "text-foreground font-medium"
            )}
          >
            <span>All Designers &amp; Makers ({totalCount})</span>
            {value === "all" && <Check size={14} className="text-[hsl(var(--gold))]" />}
          </button>

          <ul className="py-1">
            {letters.map((L) => {
              const isExpanded = expandedLetter === L;
              const designers = byLetter.get(L) ?? [];
              const containsActive =
                value !== "all" && letterOf.get(value) === L;

              return (
                <li key={L}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLetter(isExpanded ? "" : L)
                    }
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted/60 transition-colors",
                      (isExpanded || containsActive) && "bg-muted/40"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight
                        size={12}
                        className={cn(
                          "text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <span className="font-display tracking-wide">
                        {L === "#" ? "0–9" : L}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {designers.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <ul className="pb-1">
                      {designers.map((b) => {
                        const active = b === value;
                        return (
                          <li key={b}>
                            <button
                              type="button"
                              onClick={() => handlePickDesigner(b)}
                              className={cn(
                                "w-full flex items-center justify-between gap-2 pl-9 pr-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors",
                                active && "text-foreground font-medium"
                              )}
                            >
                              <span className="truncate">{b}</span>
                              {active && (
                                <Check
                                  size={13}
                                  className="text-[hsl(var(--gold))] shrink-0"
                                />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AlphabetDesignerPicker;
