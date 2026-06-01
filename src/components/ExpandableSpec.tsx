import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseMaterialsFallback } from "@/lib/parseSizeVariants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface ExpandableSpecProps {
  icon: ReactNode;
  /** Pre-formatted text. Newlines split into options. */
  text: string;
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
  const [open, setOpen] = useState(false);
  const selectedIdx = value !== undefined ? value : internalIdx;
  const showAutoHint = autoDetectedHint && didAutoSplit;

  if (lines.length === 0) return null;

  const textClasses = cn(
    "font-body text-xs md:text-sm leading-relaxed",
    emphasized ? "text-foreground font-medium" : "text-muted-foreground"
  );

  // Shared row wrapper — borderless list with hairline dividers
  const rowClasses =
    "flex items-center gap-3 w-full py-3 border-b border-border/60 first:border-t";

  // Single value → plain row
  if (lines.length === 1) {
    const label = singleValueLabel?.trim();
    const display = label ? `${label}: ${lines[0]}` : lines[0];
    return (
      <div className={rowClasses}>
        <span className="shrink-0">{icon}</span>
        <p className={cn(textClasses, "flex-1")}>{display}</p>
      </div>
    );
  }

  // Multi + placeholder → real Select (borderless list row)
  if (placeholder) {
    const NONE = "__none__";
    const handleChange = (v: string) => {
      if (v === "__clear__" || v === NONE) {
        // Always reset internal state so the trigger visually clears back to
        // the placeholder, even when a parent onChange is wired up.
        setInternalIdx(null);
        if (onChange) onChange(-1);
        return;
      }
      const idx = parseInt(v, 10);
      setInternalIdx(idx);
      if (onChange) onChange(idx);
    };
    const hasSelection = selectedIdx != null && selectedIdx >= 0;
    // Keep <Select> controlled at all times. If we ever pass `undefined`,
    // Radix flips to uncontrolled mode and the trigger keeps showing the
    // previously chosen label — making the dropdown look out of sync with
    // the gallery after "Clear selection". A sentinel "__none__" value keeps
    // it controlled and lets <SelectValue> fall back to the placeholder.
    const currentVal = hasSelection ? String(selectedIdx) : NONE;

    return (
      <>
        <Select value={currentVal} onValueChange={handleChange}>
          <SelectTrigger
            className={cn(
              rowClasses,
              "h-auto px-0 bg-transparent border-0 rounded-none shadow-none",
              "border-b border-border/60 first:border-t",
              "font-body text-xs md:text-sm text-left",
              "focus:ring-0 focus:ring-offset-0 focus:outline-none",
              "hover:text-foreground transition-colors",
              "[&>svg]:text-muted-foreground/60 [&>svg]:shrink-0",
              !hasSelection
                ? "text-muted-foreground"
                : emphasized
                ? "text-foreground font-medium"
                : "text-foreground"
            )}
          >
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 truncate">
              {hasSelection ? lines[selectedIdx ?? 0] : placeholder}
            </span>
          </SelectTrigger>
          <SelectContent className="z-[10050] bg-background border-border">
            {hasSelection && (
              <SelectItem
                value="__clear__"
                className="font-body text-xs md:text-sm cursor-pointer text-muted-foreground italic border-b border-border/60"
              >
                Clear selection
              </SelectItem>
            )}
            {lines.map((line, i) => {
              const isDisabled = disabledSet.has(i);
              return (
                <SelectItem
                  key={i}
                  value={String(i)}
                  disabled={isDisabled}
                  className={cn(
                    "font-body text-xs md:text-sm cursor-pointer",
                    isDisabled && "line-through text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  {line}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
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

  // Multi, no placeholder → render all lines as a full paragraph (no collapse).
  // The accompanying selector dropdown already exposes choice; the descriptive
  // row should show the complete spec instead of "first line + N more".
  return (
    <div className={cn(rowClasses, "items-start")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {lines.map((line, i) => (
          <p key={i} className={textClasses}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
