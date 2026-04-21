import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableSpecProps {
  icon: ReactNode;
  /** Pre-formatted text. Newlines split into lines (each one collapsible item). */
  text: string;
  /** Override default emphasis (dimensions get foreground/medium; others muted). */
  emphasized?: boolean;
  /** Force collapsed by default even if there's only 1 line (rarely needed). */
  defaultExpanded?: boolean;
}

/**
 * Renders a spec block (materials / dimensions / origin / lead time) where
 * multi-line values collapse into a dropdown that reveals the rest on click.
 *
 * Single-line values render as plain text (no toggle).
 */
export default function ExpandableSpec({
  icon,
  text,
  emphasized = false,
  defaultExpanded = false,
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

  // Multi-line — collapsible
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
