import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /** Controlled selected index (for parent-managed selection, e.g. trade pricing). */
  value?: number;
  onChange?: (index: number) => void;
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
  value,
  onChange,
}: ExpandableSpecProps) {
  let lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Auto-split single-line text on `,` and `/` for materials-style lists
  if (autoSplit && lines.length === 1) {
    const raw = lines[0];
    const colonIdx = raw.indexOf(":");
    let prefix = "";
    let body = raw;
    if (colonIdx > -1 && colonIdx < 40) {
      prefix = raw.slice(0, colonIdx + 1).trim() + " ";
      body = raw.slice(colonIdx + 1).trim();
    }
    const parts = body.split(/\s*[,/]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) lines = parts.map((p) => prefix + p);
  }

  const [internalIdx, setInternalIdx] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIdx = value ?? internalIdx;

  if (lines.length === 0) return null;

  const textClasses = cn(
    "font-body text-xs md:text-sm leading-relaxed",
    emphasized ? "text-foreground font-medium" : "text-muted-foreground"
  );

  // Single value → plain row
  if (lines.length === 1) {
    return (
      <div className="flex gap-2 items-start">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <p className={textClasses}>{lines[0]}</p>
      </div>
    );
  }

  // Multi + placeholder → real Select
  if (placeholder) {
    const handleChange = (v: string) => {
      const idx = parseInt(v, 10);
      if (onChange) onChange(idx);
      else setInternalIdx(idx);
    };
    const currentVal = selectedIdx != null ? String(selectedIdx) : undefined;

    return (
      <div className="flex gap-2 items-center">
        <span className="shrink-0">{icon}</span>
        <Select value={currentVal} onValueChange={handleChange}>
          <SelectTrigger
            className={cn(
              "h-auto py-2 px-3 bg-background border-border rounded-md font-body text-xs md:text-sm",
              "hover:border-foreground/40 focus:ring-0 focus:ring-offset-0",
              selectedIdx == null
                ? "text-muted-foreground"
                : emphasized
                ? "text-foreground font-medium"
                : "text-foreground"
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            {lines.map((line, i) => (
              <SelectItem
                key={i}
                value={String(i)}
                className="font-body text-xs md:text-sm cursor-pointer"
              >
                {line}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Multi, no placeholder → simple inline expandable
  const remaining = lines.length - 1;
  return (
    <div className="flex gap-2 items-start">
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
              <span className="font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
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
