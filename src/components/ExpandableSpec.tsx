import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { hasKnownMaterialTone, materialSwatchTone, shortFinishLabel } from "@/lib/materialSwatch";

import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";


interface ExpandableSpecProps {
  icon: ReactNode;
  /** Pre-formatted text. Newlines split into options. */
  text: string;
  /** Optional secondary line for single-value rows, e.g. imperial dimensions. */
  secondaryText?: string | null;
  /** Override default emphasis (dimensions get foreground/medium; others muted). */
  emphasized?: boolean;
  /**
   * When provided AND there are multiple options, renders a real <Select>
   * with this placeholder (e.g. "Select your material choice").
   * Single option → plain text row.
   */
  placeholder?: string;
  /**
   * If true and the input has no newlines, split on `,` and `/` to detect
   * multiple options (used for materials like "Oak, Walnut / Brass").
   * Preserves any "Prefix:" portion before the first split-character.
   */
  autoSplit?: boolean;
  /**
   * When true and autoSplit produces multiple options, render a small muted
   * caption below the dropdown explaining the options were auto-detected
   * from the materials field. Has no effect if the dropdown isn't auto-split.
   */
  autoDetectedHint?: boolean;
  /** Controlled selected index (for parent-managed selection, e.g. trade pricing). Use null for an explicit cleared state. */
  value?: number | null;
  onChange?: (index: number) => void;
  /**
   * Indices that should appear visually crossed-out and be unselectable.
   * Used when one axis (e.g. material) constrains the available options on
   * another axis (e.g. size).
   */
  disabledIndices?: number[];
  /** Optional muted caption rendered below the dropdown (e.g. constraint hints). */
  helperText?: string;
  /**
   * When the spec collapses to a single value (e.g. only one Frame option),
   * prefix the displayed value with this axis label so the public page still
   * communicates which dimension it represents — e.g. "Frame: Laser cut aluminum".
   * Ignored when multiple options render as a dropdown.
   */
  singleValueLabel?: string;
  /**
   * Renders the options as a horizontal row of circular material swatches
   * instead of a dropdown (luxury finish pickers: instant, one-tap, no
   * secondary menu). Only applies when there are multiple options.
   */
  swatchMode?: boolean;
}


/**
 * Renders a spec row (materials / dimensions / origin / lead time).
 * - Single option → icon + plain text.
 * - Multiple options + placeholder → real Select dropdown.
 *   After selecting, the trigger shows the chosen value (replacing placeholder).
 * - Multiple options without placeholder → simple inline expandable list.
 */
export default function ExpandableSpec({
  icon,
  text,
  secondaryText,
  emphasized = false,
  placeholder,
  autoSplit = false,
  autoDetectedHint = false,
  value,
  onChange,
  disabledIndices,
  helperText,
  singleValueLabel,
  swatchMode = false,
}: ExpandableSpecProps) {

  const disabledSet = new Set(disabledIndices ?? []);
  let lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let didAutoSplit = false;

  // Auto-split single-line text into multiple finish options. Uses the shared
  // parseMaterialsFallback which handles both explicit separators (, / ; |)
  // and concatenated repeated-base patterns like
  // "Cast Bronze Green Cast Bronze White Cast Bronze".
  if (autoSplit && lines.length === 1) {
    const raw = lines[0];
    const colonIdx = raw.indexOf(":");
    let prefix = "";
    let body = raw;
    if (colonIdx > -1 && colonIdx < 40) {
      prefix = raw.slice(0, colonIdx + 1).trim() + " ";
      body = raw.slice(colonIdx + 1).trim();
    }
    const parts = parseMaterialsFallback(body);
    if (parts.length > 1) {
      lines = parts.map((p) => prefix + p);
      didAutoSplit = true;
    }
  }

  const isMobile = useIsMobile();
  const [internalIdx, setInternalIdx] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIdx = value !== undefined ? value : internalIdx;
  const showAutoHint = autoDetectedHint && didAutoSplit;

  // Focus the active option when the listbox opens or active changes.
  useEffect(() => {
    if (open) optionRefs.current[activeIdx]?.focus();
  }, [open, activeIdx]);

  if (lines.length === 0) return null;

  // Mobile clarity: the Ø glyph is standard in design, but a tiny uppercase
  // "Diameter" cue above the measurement removes any doubt for retail buyers.
  const showDiameterHint = isMobile && lines.some((l) => l.includes("Ø"));
  const diameterHint = showDiameterHint ? (
    <span className="block font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
      Diameter
    </span>
  ) : null;

  const textClasses = cn(
    "font-body text-sm leading-relaxed",
    emphasized ? "text-foreground font-medium" : "text-muted-foreground"
  );

  // Shared row wrapper — borderless list with hairline dividers
  const rowClasses =
    "flex items-center gap-5 w-full py-4 border-b border-border/60 first:border-t";

  // Single value → plain row
  if (lines.length === 1) {
    const label = singleValueLabel?.trim();
    const display = label ? `${label}: ${lines[0]}` : lines[0];
    return (
      <div className={rowClasses}>
        <span className="shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          {diameterHint}
          <p className={textClasses}>
            {display}
            {secondaryText && (
              <span className="block text-xs mt-0.5 text-muted-foreground/70">
                {secondaryText}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }


  // Multi + swatchMode → horizontal row of circular material swatches.
  if (swatchMode && placeholder) {
    const pickSwatch = (i: number) => {
      if (disabledSet.has(i)) return;
      try {
        (navigator as any)?.vibrate?.(8);
      } catch {
        /* haptics unsupported — silent */
      }
      if (i === selectedIdx) {
        setInternalIdx(null);
        onChange?.(-1);
        return;
      }
      setInternalIdx(i);
      onChange?.(i);
    };
    const activeLabel = selectedIdx != null && selectedIdx >= 0 ? lines[selectedIdx] : null;

    return (
      <div className="border-b border-border/60 first:border-t py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {placeholder.replace(/^select your\s+/i, "")}
          </span>
          {activeLabel && (
            <span className="font-body text-[12px] text-foreground text-right min-w-0 truncate">
              {shortFinishLabel(activeLabel)}
            </span>
          )}
        </div>

        <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto scrollbar-hide px-1 pb-1 [&::-webkit-scrollbar]:hidden">
          {lines.map((line, i) => {
            const isDisabled = disabledSet.has(i);
            const isSelected = i === selectedIdx;
            const tone = materialSwatchTone(line);
            return (
              <button
                key={i}
                type="button"
                onClick={() => pickSwatch(i)}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
                title={shortFinishLabel(line)}
                aria-label={shortFinishLabel(line)}
                className={cn(
                  "shrink-0 h-11 w-11 rounded-full transition-all duration-200 touch-manipulation",
                  "ring-offset-2 ring-offset-background",
                  isSelected ? "ring-1 ring-foreground scale-105" : "ring-1 ring-border/60 hover:ring-foreground/40",
                  isDisabled && "opacity-30 cursor-not-allowed"
                )}
                style={{ backgroundImage: tone.css }}
              />
            );
          })}
        </div>

        {helperText && (
          <p className="mt-2 font-body text-[11px] text-muted-foreground/80 leading-snug">{helperText}</p>
        )}
      </div>
    );
  }

  // Multi + placeholder → inline expanding picker that pushes rows below
  // downward (instead of overlaying them like a Radix/Native select).

  if (placeholder) {
    const hasSelection = selectedIdx != null && selectedIdx >= 0;
    const firstEnabled = () => {
      for (let i = 0; i < lines.length; i++) if (!disabledSet.has(i)) return i;
      return 0;
    };
    const nextEnabled = (from: number, dir: 1 | -1) => {
      const n = lines.length;
      for (let step = 1; step <= n; step++) {
        const i = (from + dir * step + n * step) % n;
        if (!disabledSet.has(i)) return i;
      }
      return from;
    };
    const openList = (focusIdx?: number) => {
      const start =
        focusIdx ??
        (hasSelection && !disabledSet.has(selectedIdx as number)
          ? (selectedIdx as number)
          : firstEnabled());
      setActiveIdx(start);
      setOpen(true);
    };
    const closeList = (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const pick = (i: number) => {
      if (disabledSet.has(i)) return;
      // Native-feeling confirmation: a whisper-light haptic tick on selection.
      try {
        (navigator as any)?.vibrate?.(8);
      } catch {
        /* haptics unsupported — silent */
      }
      setInternalIdx(i);
      if (onChange) onChange(i);
      closeList();
    };

    const clear = () => {
      setInternalIdx(null);
      if (onChange) onChange(-1);
      closeList();
    };

    const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        openList(nextEnabled(firstEnabled(), -1));
      }
    };
    const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeList();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => nextEnabled(i, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => nextEnabled(i, -1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIdx(firstEnabled());
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIdx(nextEnabled(firstEnabled(), -1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(activeIdx);
      } else if (e.key === "Tab") {
        // Let Tab move focus naturally, but close the list so it doesn't trap.
        closeList(false);
      }
    };

    // Shared option rows — rendered inline on desktop, inside the bottom sheet
    // on mobile/PWA so selection feels like a native picker.
    const optionNodes = (
      <>
        {hasSelection && (
          <li>
            <button
              type="button"
              onClick={clear}
              className="w-full text-left font-body text-xs md:text-sm py-3 md:py-2 text-muted-foreground italic hover:text-foreground transition-colors"
            >
              Clear selection
            </button>
          </li>
        )}
        {lines.map((line, i) => {
          const isDisabled = disabledSet.has(i);
          const isSelected = i === selectedIdx;
          return (
            <li key={i}>
              <button
                ref={(el) => (optionRefs.current[i] = el)}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                tabIndex={i === activeIdx ? 0 : -1}
                onClick={() => pick(i)}
                className={cn(
                  "w-full text-left font-body text-xs md:text-sm py-3 md:py-2 leading-relaxed whitespace-normal transition-colors active:opacity-60",
                  "focus:outline-none focus-visible:bg-muted/40",
                  "md:border-0 border-b border-border/40 last:border-0",
                  isDisabled
                    ? "line-through text-muted-foreground/50 cursor-not-allowed"
                    : "hover:text-foreground",
                  isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {line}
              </button>
            </li>
          );
        })}
      </>
    );

    return (

      <div className="border-b border-border/60 first:border-t">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? closeList(false) : openList())}
          onKeyDown={onTriggerKey}
          className={cn(
            "flex items-center gap-5 w-full py-4 text-left",
            "font-body text-sm",
            "focus:outline-none focus-visible:ring-0",
            "hover:text-foreground transition-colors",
            !hasSelection
              ? "text-muted-foreground"
              : emphasized
              ? "text-foreground font-medium"
              : "text-foreground"
          )}
        >
          <span className="shrink-0">{icon}</span>
          <span className="flex-1 min-w-0 whitespace-normal break-words leading-relaxed">
            {diameterHint}
            {hasSelection ? lines[selectedIdx ?? 0] : placeholder}
          </span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {/* Desktop: inline expanding list (pushes rows below downward). */}
        {open && !isMobile && (
          <ul
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKey}
            className="pb-3 pl-[44px] pr-2 flex flex-col focus:outline-none"
          >
            {optionNodes}
          </ul>
        )}

        {/* Mobile / PWA: native-feeling bottom sheet. */}
        {isMobile && (
          <Drawer
            open={open}
            onOpenChange={(o) => {
              if (!o) closeList(false);
            }}
          >
            <DrawerContent className="rounded-t-[14px] border-border/60">
              <DrawerTitle className="sr-only">{placeholder}</DrawerTitle>
              <div className="px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground pb-3">
                  {placeholder}
                </p>

                <ul
                  role="listbox"
                  tabIndex={-1}
                  className="flex flex-col max-h-[58vh] overflow-y-auto overscroll-contain focus:outline-none"
                >
                  {optionNodes}
                </ul>
              </div>
            </DrawerContent>
          </Drawer>
        )}

        {showAutoHint && (
          <p
            className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 pb-3 pl-[44px]"
            role="note"
          >
            Finishes auto-detected — please confirm at quote
          </p>
        )}
        {helperText && (
          <p
            className="font-body text-[10px] tracking-wide text-muted-foreground/80 pb-3 pl-[44px] italic"
            role="note"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }

  // Multi, no placeholder → full descriptive copy inside the same hairline row.
  return (
    <div className={cn(rowClasses, "items-start")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {lines.map((line, i) => (
          <p key={i} className={textClasses}>{line}</p>
        ))}
        {secondaryText && (
          <p className="text-xs mt-0.5 text-muted-foreground/70">{secondaryText}</p>
        )}
      </div>
    </div>
  );
}

