/**
 * Two-step A–Z designer/maker picker for the Trade Gallery filter bar.
 *
 * Step 1 — letter dropdown: lists every initial that has at least one designer,
 *          plus the count of designers under that letter, plus an "All".
 * Step 2 — designers dropdown: appears once a letter is chosen and lists only
 *          the designers whose normalized initial matches that letter.
 *
 * Replaces the legacy "All Designers & Makers (99)" select which had become
 * unwieldy. Accent-folded for sorting and grouping (Andrée → A, Félix → F)
 * but the original display label is preserved in the option text.
 */
import { useMemo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  brands: string[];
  /** Currently selected brand display label, or "all". */
  value: string;
  onChange: (next: string) => void;
  /** Tailwind classes to match neighbouring filter selects. */
  selectClassName?: string;
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const initialOf = (label: string): string => {
  const cleaned = stripAccents(label.trim()).toUpperCase();
  // Skip leading articles like "L'", "Le ", "La ", "The "
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
  // Group brands by initial.
  const { letters, byLetter, letterOf } = useMemo(() => {
    const map = new Map<string, string[]>();
    const lookup = new Map<string, string>();
    for (const b of brands) {
      const L = initialOf(b);
      lookup.set(b, L);
      if (!map.has(L)) map.set(L, []);
      map.get(L)!.push(b);
    }
    // Sort each letter group alphabetically by accent-folded label.
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

  // Active letter is derived from the current value so it stays in sync
  // with deep links / external state changes.
  const activeLetter = value !== "all" ? letterOf.get(value) ?? "" : "";

  // Local UI state for the letter the user is browsing (may differ from
  // the active brand selection while navigating the menu).
  const [browseLetter, setBrowseLetter] = useStateWithFallback(activeLetter);

  // Keep the browse letter in sync when an external change selects a brand
  // from a different letter (e.g. clearing filters).
  useEffect(() => {
    if (activeLetter && activeLetter !== browseLetter) {
      setBrowseLetter(activeLetter);
    }
    if (value === "all" && browseLetter) {
      // keep the letter chosen so the second dropdown stays visible
    }
  }, [activeLetter, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const designersForLetter = browseLetter ? byLetter.get(browseLetter) ?? [] : [];

  const handleLetterChange = (next: string) => {
    if (next === "all") {
      setBrowseLetter("");
      onChange("all");
      return;
    }
    setBrowseLetter(next);
    // If the current selection no longer belongs to the new letter, reset
    // back to "all" so the grid widens and the user can pick a designer.
    if (value !== "all" && letterOf.get(value) !== next) {
      onChange("all");
    }
  };

  const totalCount = brands.length;

  return (
    <>
      <select
        value={browseLetter || "all"}
        onChange={(e) => handleLetterChange(e.target.value)}
        aria-label="Filter designers and makers by initial"
        className={cn(selectClassName)}
      >
        <option value="all">All Designers &amp; Makers ({totalCount})</option>
        {letters.map((L) => (
          <option key={L} value={L}>
            {L === "#" ? "0–9" : L} ({byLetter.get(L)!.length})
          </option>
        ))}
      </select>

      {browseLetter && designersForLetter.length > 0 && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Designers starting with ${browseLetter}`}
          className={cn(selectClassName)}
        >
          <option value="all">
            All in “{browseLetter === "#" ? "0–9" : browseLetter}” (
            {designersForLetter.length})
          </option>
          {designersForLetter.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Tiny helper: useState with an initial value that may change later. */
/* ------------------------------------------------------------------ */
function useStateWithFallback(initial: string) {
  const ref = useRef(initial);
  const [v, setV] = useState(initial);
  // If the prop-derived initial changed and local state is empty, sync once.
  useEffect(() => {
    if (initial && !v) {
      ref.current = initial;
      setV(initial);
    }
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, setV] as const;
}

export default AlphabetDesignerPicker;
