import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseMaterialsFallback } from "@/lib/parseSizeVariants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  /** Controlled selected index (for parent-managed selection, e.g. trade pricing). */
  value?: number;
  onChange?: (index: number) => void;
  /**
   * Indices that should appear visually crossed-out and be unselectable.
   * Used when one axis (e.g. material) constrains the available options on
   * another axis (e.g. size).
   */
  disabledIndices?: number[];
  /** Optional muted caption rendered below the dropdown (e.g. constraint hints). */
  helperText?: string;
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
  const selectedIdx = value ?? internalIdx;
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
    return (
      <div className={rowClasses}>
        <span className="shrink-0">{icon}</span>
        <p className={cn(textClasses, "flex-1")}>{lines[0]}</p>
      </div>
    );
  }

  // Multi + placeholder → real Select (borderless list row)
  if (placeholder) {
    const handleChange = (v: string) => {
      if (v === "__clear__") {
        if (onChange) onChange(-1);
        else setInternalIdx(null);
        return;
      }
      const idx = parseInt(v, 10);
      if (onChange) onChange(idx);
      else setInternalIdx(idx);
    };
    const currentVal = selectedIdx != null ? String(selectedIdx) : undefined;
    const hasSelection = selectedIdx != null && selectedIdx >= 0;

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
              selectedIdx == null
                ? "text-muted-foreground"
                : emphasized
                ? "text-foreground font-medium"
                : "text-foreground"
            )}
          >
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 truncate">
              <SelectValue placeholder={placeholder} />
            </span>
          </SelectTrigger>
          <SelectContent className="z-[130] bg-background border-border">
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

  // Multi, no placeholder → simple inline expandable (borderless list row)
  const remaining = lines.length - 1;
  const panelId = useId();
  return (
    <div className={cn(rowClasses, "items-start")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-start gap-1.5 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm motion-reduce:transition-none"
          aria-expanded={open}
          aria-controls={panelId}
        >
          <p className={textClasses}>{lines[0]}</p>
          <span className="flex items-center gap-1 mt-0.5 shrink-0">
            {!open && (
              <span className="font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                +{remaining}
              </span>
            )}
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={cn(
                "text-muted-foreground/70 group-hover:text-foreground transition-all motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          </span>
        </button>
        <div id={panelId} role="region" hidden={!open}>
          {open && (
            <div className="mt-1 flex flex-col gap-0.5">
              {lines.slice(1).map((line, i) => (
                <p key={i} className={textClasses}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
