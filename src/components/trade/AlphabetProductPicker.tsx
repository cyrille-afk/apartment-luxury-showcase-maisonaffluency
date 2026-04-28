/**
 * Single-field A–Z → Designer → Product picker.
 *
 * Closed: shows the current selection (or placeholder).
 * Open: vertical list of letters. Click a letter → expands to that letter's
 * designers. Click a designer → expands to its products. Click a product →
 * selects it and closes the menu. Accent-folded for grouping; original
 * labels (with diacritics) are preserved in display.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerItem {
  id: string;
  label: string;
  group: string; // designer / brand name
}

interface Props {
  items: PickerItem[];
  value: string; // selected id, or ""
  onChange: (id: string) => void;
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

const AlphabetProductPicker = ({
  items,
  value,
  onChange,
  placeholder = "Select a product…",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedLetter, setExpandedLetter] = useState<string>("");
  const [expandedGroup, setExpandedGroup] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  const { letters, byLetter, groupOfItem, letterOfGroup, selectedItem } =
    useMemo(() => {
      // group designers by initial
      const byLetter = new Map<string, Map<string, PickerItem[]>>();
      const groupOfItem = new Map<string, string>();
      const letterOfGroup = new Map<string, string>();

      const allGroups = new Set<string>();
      for (const it of items) {
        groupOfItem.set(it.id, it.group);
        allGroups.add(it.group);
      }

      for (const g of allGroups) {
        const L = initialOf(g);
        letterOfGroup.set(g, L);
        if (!byLetter.has(L)) byLetter.set(L, new Map());
        byLetter.get(L)!.set(g, []);
      }

      for (const it of items) {
        byLetter.get(letterOfGroup.get(it.group)!)!.get(it.group)!.push(it);
      }

      // sort products within each group
      for (const [, groups] of byLetter) {
        for (const [, arr] of groups) {
          arr.sort((a, b) =>
            stripAccents(a.label).localeCompare(stripAccents(b.label), undefined, {
              sensitivity: "base",
            })
          );
        }
      }

      const letters = [...byLetter.keys()].sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b);
      });

      const selectedItem = items.find((i) => i.id === value) || null;
      return { letters, byLetter, groupOfItem, letterOfGroup, selectedItem };
    }, [items, value]);

  // Jump to selection context when opening
  useEffect(() => {
    if (open && selectedItem) {
      const g = selectedItem.group;
      setExpandedGroup(g);
      setExpandedLetter(letterOfGroup.get(g) || "");
    }
    if (!open) {
      setExpandedLetter("");
      setExpandedGroup("");
    }
  }, [open, selectedItem, letterOfGroup]);

  // Click-outside / esc
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

  const buttonLabel = selectedItem
    ? `${selectedItem.group} — ${selectedItem.label}`
    : placeholder;

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
          {buttonLabel}
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
              const groupNames = [...groups.keys()].sort((a, b) =>
                stripAccents(a).localeCompare(stripAccents(b), undefined, {
                  sensitivity: "base",
                })
              );
              const containsActive =
                selectedItem && letterOfGroup.get(selectedItem.group) === L;

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
                      {groupNames.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <ul className="pb-1">
                      {groupNames.map((g) => {
                        const groupExpanded = expandedGroup === g;
                        const products = groups.get(g)!;
                        const groupContainsActive =
                          selectedItem?.group === g;
                        return (
                          <li key={g}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGroup(groupExpanded ? "" : g)
                              }
                              className={cn(
                                "w-full flex items-center justify-between gap-2 pl-9 pr-3 py-1.5 text-left text-[13px] hover:bg-muted/60 transition-colors",
                                (groupExpanded || groupContainsActive) &&
                                  "bg-muted/30"
                              )}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <ChevronRight
                                  size={11}
                                  className={cn(
                                    "text-muted-foreground transition-transform shrink-0",
                                    groupExpanded && "rotate-90"
                                  )}
                                />
                                <span className="truncate">{g}</span>
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {products.length}
                              </span>
                            </button>

                            {groupExpanded && (
                              <ul className="pb-1">
                                {products.map((p) => {
                                  const active = p.id === value;
                                  return (
                                    <li key={p.id}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onChange(p.id);
                                          setOpen(false);
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-between gap-2 pl-14 pr-3 py-1.5 text-left text-[12.5px] hover:bg-muted/60 transition-colors",
                                          active && "text-foreground font-medium"
                                        )}
                                      >
                                        <span className="truncate">{p.label}</span>
                                        {active && (
                                          <Check
                                            size={12}
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

export default AlphabetProductPicker;
