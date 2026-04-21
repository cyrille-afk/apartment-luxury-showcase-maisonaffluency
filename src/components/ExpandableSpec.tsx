import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableSpecProps {
  icon: ReactNode;
  /** Pre-formatted text. Newlines split into lines (each one collapsible item). */
  text: string;
  /** Override default emphasis (dimensions get foreground/medium; others muted). */
  emphasized?: boolean;
  /** Force expanded by default (rarely needed). */
  defaultExpanded?: boolean;
  /**
   * When provided AND there are multiple lines, renders as a select-style
   * dropdown with this placeholder label (e.g. "Select your material choice").
   * Single-line values still render as plain text.
   */
  placeholder?: string;
  /**
   * If true and the input has no newlines, split on `,` and `/` to detect
   * multiple options (used for materials like "Oak, Walnut / Brass").
   * Preserves any "Prefix:" portion before the first split-character.
   */
  autoSplit?: boolean;
}

/**
 * Renders a spec block (materials / dimensions / origin / lead time).
 *
 * Modes:
 *  - Single line → plain text, no toggle.
 *  - Multi-line + placeholder → select-style dropdown with placeholder label.
 *  - Multi-line, no placeholder → inline "first line +N" collapsible.
 */
export default function ExpandableSpec({
  icon,
  text,
  emphasized = false,
  defaultExpanded = false,
  placeholder,
}: ExpandableSpecProps) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const [open, setOpen] = useState(defaultExpanded);

  if (lines.length === 0) return null;

  const textClasses = cn(
    "font-body text-xs md:text-sm leading-relaxed",
    emphasized ? "text-foreground font-medium" : "text-muted-foreground"
  );

  // Single line — plain render, no toggle
  if (lines.length === 1) {
    return (
      <div className="flex gap-1.5 items-start">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className={textClasses}>{lines[0]}</p>
      </div>
    );
  }

  // Multi-line + placeholder → select-style dropdown
  if (placeholder) {
    return (
      <div className="flex gap-1.5 items-start">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="group w-full flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left hover:border-foreground/40 transition-colors"
          >
            <span className="font-body text-xs md:text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {placeholder}
              <span className="ml-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
                ({lines.length})
              </span>
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground/70 group-hover:text-foreground transition-all shrink-0",
                open && "rotate-180"
              )}
            />
          </button>
          {open && (
            <ul className="mt-1.5 flex flex-col rounded-md border border-border bg-background overflow-hidden">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className={cn(
                    textClasses,
                    "px-3 py-2 border-b border-border/60 last:border-b-0"
                  )}
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // Multi-line — inline collapsible (legacy)
  const remaining = lines.length - 1;
  return (
    <div className="flex gap-1.5 items-start">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-start gap-1.5 text-left w-full"
          aria-expanded={open}
        >
          <p className={textClasses}>{lines[0]}</p>
          <span className="flex items-center gap-1 mt-0.5 shrink-0">
            {!open && (
              <span className="font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 group-hover:text-foreground transition-colors">
                +{remaining}
              </span>
            )}
            <ChevronDown
              size={13}
              className={cn(
                "text-muted-foreground/70 group-hover:text-foreground transition-all",
                open && "rotate-180"
              )}
            />
          </span>
        </button>
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
  );
}
