import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseMaterialsFallback } from "@/lib/parseSizeVariants";

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

  const [internalIdx, setInternalIdx] = useState<number | null>(null);
  // (open state removed — multi/no-placeholder now renders full paragraph)
  const selectedIdx = value !== undefined ? value : internalIdx;
  const showAutoHint = autoDetectedHint && didAutoSplit;

  if (lines.length === 0) return null;

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
        <p className={cn(textClasses, "flex-1")}>
          {display}
          {secondaryText && (
            <span className="block text-xs mt-0.5 text-muted-foreground/70">
              {secondaryText}
            </span>
          )}
        </p>
      </div>
    );
  }

  // Multi + placeholder → inline expanding picker that pushes rows below
  // downward (instead of overlaying them like a Radix/Native select).
  if (placeholder) {
    const [open, setOpen] = useState(false);
    const hasSelection = selectedIdx != null && selectedIdx >= 0;
    const pick = (i: number) => {
      setInternalIdx(i);
      if (onChange) onChange(i);
      setOpen(false);
    };
    const clear = () => {
      setInternalIdx(null);
      if (onChange) onChange(-1);
      setOpen(false);
    };

    return (
      <>
        <div className="border-b border-border/60 first:border-t">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
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
              {hasSelection ? lines[selectedIdx ?? 0] : placeholder}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
          {open && (
            <ul
              role="listbox"
              className="pb-3 pl-[44px] pr-2 flex flex-col"
            >
              {hasSelection && (
                <li>
                  <button
                    type="button"
                    onClick={clear}
                    className="w-full text-left font-body text-xs md:text-sm py-2 text-muted-foreground italic hover:text-foreground transition-colors"
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
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && pick(i)}
                      className={cn(
                        "w-full text-left font-body text-xs md:text-sm py-2 leading-relaxed whitespace-normal transition-colors",
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
            </ul>
          )}
        </div>
        {showAutoHint && (
          <p
            className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 mt-1 pl-[26px]"
            role="note"
          >
            Finishes auto-detected — please confirm at quote
          </p>
        )}
        {helperText && (
          <p
            className="font-body text-[10px] tracking-wide text-muted-foreground/80 mt-1 pl-[26px] italic"
            role="note"
          >
            {helperText}
          </p>
        )}
      </>
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

