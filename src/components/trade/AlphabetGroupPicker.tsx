/**
 * Single-field A–Z → Group picker (designers or brands).
 * Closed: shows current selection (or placeholder).
 * Open: vertical list of letters → click letter → expands to that letter's
 * groups → click group → selects it and closes. Accent-folded for grouping.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GroupItem {
  name: string;
  count: number;
}

interface Props {
  items: GroupItem[];
  value: string; // selected name, or ""
  onChange: (name: string) => void;
  placeholder?: string;
  className?: string;
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

const AlphabetGroupPicker = ({
  items,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedLetter, setExpandedLetter] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  const { letters, byLetter, letterOfGroup, selectedItem } = useMemo(() => {
    const byLetter = new Map<string, GroupItem[]>();
    const letterOfGroup = new Map<string, string>();
    for (const it of items) {
      const L = initialOf(it.name);
      letterOfGroup.set(it.name, L);
      if (!byLetter.has(L)) byLetter.set(L, []);
      byLetter.get(L)!.push(it);
    }
    for (const [, arr] of byLetter) {
      arr.sort((a, b) =>
        stripAccents(a.name).localeCompare(stripAccents(b.name), undefined, {
          sensitivity: "base",
        })
      );
    }
    const letters = [...byLetter.keys()].sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
    const selectedItem = items.find((i) => i.name === value) || null;
    return { letters, byLetter, letterOfGroup, selectedItem };
  }, [items, value]);

  useEffect(() => {
    if (open && selectedItem) {
      setExpandedLetter(letterOfGroup.get(selectedItem.name) || "");
    }
    if (!open) setExpandedLetter("");
  }, [open, selectedItem, letterOfGroup]);

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

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full inline-flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 font-body text-sm text-foreground text-left focus:outline-none focus:ring-1 focus:ring-foreground/20",
          className
        )}
      >
        <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
          {selectedItem ? `${selectedItem.name} (${selectedItem.count})` : placeholder}
        </span>
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
          className="absolute z-30 mt-1 left-0 w-full max-h-[min(70vh,28rem)] overflow-y-auto rounded-md border border-border bg-background shadow-lg font-body text-sm"
          role="listbox"
        >
          <ul className="py-1">
            {letters.map((L) => {
              const isExpanded = expandedLetter === L;
              const groups = byLetter.get(L)!;
              const containsActive =
                selectedItem && letterOfGroup.get(selectedItem.name) === L;
              return (
                <li key={L}>
                  <button
                    type="button"
                    onClick={() => setExpandedLetter(isExpanded ? "" : L)}
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
                      {groups.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <ul className="pb-1">
                      {groups.map((g) => {
                        const active = g.name === value;
                        return (
                          <li key={g.name}>
                            <button
                              type="button"
                              onClick={() => {
                                onChange(g.name);
                                setOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between gap-2 pl-9 pr-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors",
                                active && "text-foreground font-medium bg-muted/30"
                              )}
                            >
                              <span className="truncate">{g.name}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground">
                                  {g.count}
                                </span>
                                {active && (
                                  <Check
                                    size={12}
                                    className="text-[hsl(var(--gold))]"
                                  />
                                )}
                              </span>
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

export default AlphabetGroupPicker;
